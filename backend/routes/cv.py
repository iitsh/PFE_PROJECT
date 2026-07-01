# Importe les composants FastAPI pour les routes, erreurs, dépendances et fichiers uploadés
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
# Importe la fonction de connexion à la base de données
from database import get_db
# Importe la dépendance JWT pour protéger les routes
from routes.auth import get_current_user
# Importe le pipeline CV (analyse IA, génération HTML/PDF, etc.)
import cv_pipeline
# Importe tous les modèles Pydantic pour la validation des données CV
from cv_models import ProfilCandidatModel, ExperienceModel, FormationModel, GroupeCompetenceModel, ProjetModel, AnalyseOffre
# Importe json pour sérialiser/désérialiser les données JSONB
import json
import traceback
# Importe os pour les opérations sur les fichiers
import os
# Importe FileResponse pour renvoyer des fichiers (téléchargement PDF)
from fastapi.responses import FileResponse
# Importe BaseModel pour créer des modèles Pydantic inline
from pydantic import BaseModel

# ── Crée le routeur pour toutes les routes liées au CV ───────────────────────
router = APIRouter()

# ── Helper : récupère l'ID utilisateur depuis son email ──────────────────────
def get_user_id(email: str) -> int:
    # Ouvre une connexion à la BDD
    conn = get_db()
    cur = conn.cursor()
    # Recherche l'utilisateur par email
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    # Si l'utilisateur n'existe pas, renvoie une erreur 404
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    # Retourne l'ID utilisateur
    return user[0]

# ── POST /parse : reçoit un PDF, l'analyse avec l'IA, retourne les données extraites (pas de BDD) ─────
# >>> async def car file.read() est une opération I/O asynchrone (lecture
#     de fichier réseau) — permet au serveur de traiter d'autres requêtes
#     en attendant. UploadFile/File(...) = type FastAPI natif pour gérer
#     un upload de fichier multipart.
@router.post("/parse")
async def parse_cv(file: UploadFile = File(...), payload: dict = Depends(get_current_user)):
    """Reçoit un PDF, extrait les données via l'IA, et les retourne (sans sauvegarde en BDD).
    La sauvegarde en BDD se fait uniquement quand l'utilisateur clique sur 'Valider le profil'."""
    # Vérifie que le fichier est un PDF
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")
    
    # Lit le contenu binaire du fichier uploadé
    # >>> await file.read() = lit tout le contenu en mémoire (bytes), sans
    #     bloquer le serveur pendant l'opération I/O.
    contents = await file.read()
    # Extrait le texte du PDF avec pdfplumber
    texte_cv = cv_pipeline.lire_pdf(contents)
    # Vérifie que du texte a bien été extrait
    if not texte_cv:
        raise HTTPException(status_code=400, detail="Impossible de lire le texte du PDF")
    
    try:
        # Envoie le texte à l'IA pour analyse (limite à 12000 caractères pour les tokens)
        profil = cv_pipeline.analyser_cv(texte_cv[:12000])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse IA : {str(e)}")
    
    # Retourne le profil extrait (converti en dict JSON) — PAS de sauvegarde en BDD
    return profil.model_dump()


# ── GET /profil : reconstruit et retourne le profil complet depuis la BDD ────
# >>> ProfilCandidatModel n'est jamais stocké comme un seul bloc — il est
#     RECONSTRUIT à la volée depuis 6 tables différentes à chaque appel
#     (users + experience + formation + competence + projet + langue).
@router.get("/profil")
def get_profil(payload: dict = Depends(get_current_user)):
    """Reconstruit le profil depuis les tables SQL et le renvoie."""
    # Récupère l'ID utilisateur
    user_id = get_user_id(payload["sub"])
    conn = get_db()
    cur = conn.cursor()
    
    # Récupère les infos personnelles depuis la table users
    cur.execute("SELECT nom, prenom, email, numero, ville, linkedin, github, portfolio, resume FROM users WHERE id = %s", (user_id,))
    user_info = cur.fetchone()
    
    # Récupère toutes les expériences triées par ID
    cur.execute("SELECT id_experience, poste, entreprise, date_debut, date_fin, description, lieu FROM experience WHERE user_id = %s ORDER BY id_experience ASC", (user_id,))
    exps = cur.fetchall()
    
    # Récupère toutes les formations triées par ID
    cur.execute("SELECT id_formation, diplome, etablissement, date_debut, date_fin, description, lieu FROM formation WHERE user_id = %s ORDER BY id_formation ASC", (user_id,))
    forms = cur.fetchall()
    
    # Récupère toutes les compétences
    cur.execute("SELECT id_competence, nom_competence, niveau, categorie FROM competence WHERE user_id = %s", (user_id,))
    comps = cur.fetchall()

    # Récupère tous les projets
    cur.execute("SELECT id_projet, nom, description, technologies FROM projet WHERE user_id = %s", (user_id,))
    projs = cur.fetchall()

    # Récupère toutes les langues
    cur.execute("SELECT id_langue, nom_langue, niveau FROM langue WHERE user_id = %s", (user_id,))
    langs = cur.fetchall()
    
    # Ferme le curseur (garde la connexion pour la suite)
    cur.close()
    conn.close()
    
    # Reconstruit la liste des expériences en objets ExperienceModel
    experiences = []
    for exp in exps:
        experiences.append(ExperienceModel(
            id_experience=exp[0], titre=exp[1], entreprise=exp[2],
            # Utilise date_debat ou date_fin comme durée
            duree=exp[3] if exp[3] else exp[4], lieu=exp[6],
            # Re-split la description en liste de lignes
            description=exp[5].split('\\n') if exp[5] else []
        ))
        
    # Reconstruit la liste des formations en objets FormationModel
    formations = []
    for form in forms:
        formations.append(FormationModel(
            id_formation=form[0], diplome=form[1], etablissement=form[2],
            annee=form[3], description=form[5].split('\\n') if form[5] else []
        ))
        
    # Regroupe les compétences par catégorie (dictionnaire catégorie → éléments)
    # >>> En BDD, chaque compétence est une LIGNE séparée avec sa catégorie
    #     répétée. Ici on les regroupe en mémoire pour reconstruire la
    #     structure GroupeCompetenceModel (categorie + liste d'elements).
    comp_dict = {}
    for comp in comps:
        cat = comp[3]
        if cat not in comp_dict: comp_dict[cat] = []
        comp_dict[cat].append(comp[1])
        
    # Convertit le dictionnaire en liste de GroupeCompetenceModel
    competences = []
    for cat, elements in comp_dict.items():
        competences.append(GroupeCompetenceModel(categorie=cat, elements=elements))

    # Reconstruit la liste des projets
    projets = []
    for proj in projs:
        projets.append(ProjetModel(
            nom=proj[1], description=proj[2].split('\\n') if proj[2] else [],
            # Re-split les technologies séparées par des virgules
            technologies=proj[3].split(',') if proj[3] else []
        ))

    # Reconstruit la liste des langues (nom + niveau si disponible)
    langues = []
    for lang in langs:
        langues.append(lang[1] + (f' — {lang[2]}' if lang[2] else ''))
        
    # Assemble le profil complet
    profil = ProfilCandidatModel(
        nom=user_info[0], prenom=user_info[1], email=user_info[2], telephone=user_info[3],
        ville=user_info[4], linkedin=user_info[5], github=user_info[6],
        portfolio=user_info[7], resume=user_info[8],
        experiences=experiences, formations=formations, competences=competences,
        projets=projets, langues=langues
    )
    # Retourne le profil en JSON
    return profil.model_dump()


# ── PUT /profil : met à jour le profil complet depuis le frontend ────────────
@router.put("/profil")
def update_profil(profil: ProfilCandidatModel, payload: dict = Depends(get_current_user)):
    """Met à jour les tables du profil de l'utilisateur."""
    # Récupère l'ID utilisateur
    user_id = get_user_id(payload["sub"])
    conn = get_db()
    cur = conn.cursor()
    try:
        # Met à jour les champs optionnels de users (ne remplace jamais les données d'inscription)
        cur.execute("""
            UPDATE users SET
                ville = CASE WHEN ville IS NULL OR ville = '' THEN %s ELSE ville END,
                linkedin = CASE WHEN linkedin IS NULL OR linkedin = '' THEN %s ELSE linkedin END,
                github = CASE WHEN github IS NULL OR github = '' THEN %s ELSE github END,
                portfolio = CASE WHEN portfolio IS NULL OR portfolio = '' THEN %s ELSE portfolio END,
                resume = CASE WHEN resume IS NULL OR resume = '' THEN %s ELSE resume END
            WHERE id = %s
        """, (
            profil.ville or '', profil.linkedin or '', profil.github or '',
            profil.portfolio or '', profil.resume or '', user_id
        ))

        # Supprime toutes les données des tables enfants (on remplace tout)
        # >>> Pattern DELETE + INSERT (remplacement complet) : si on faisait
        #     juste INSERT sans DELETE, une 2e modification dupliquerait les
        #     anciennes lignes au lieu de les remplacer — la BDD garde
        #     toujours une image fidèle et propre du profil le plus récent.
        cur.execute("DELETE FROM experience WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM formation WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM competence WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM projet WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM langue WHERE user_id = %s", (user_id,))
        
        # Réinsère les expériences
        if profil.experiences:
            for exp in profil.experiences:
                desc = "\\n".join(exp.description)
                cur.execute("""
                    INSERT INTO experience (user_id, poste, entreprise, date_debut, date_fin, description, lieu)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (user_id, exp.titre or '', exp.entreprise or '', exp.duree, None, desc, exp.lieu))
                
        # Réinsère les formations
        if profil.formations:
            for form in profil.formations:
                desc = "\\n".join(form.description)
                cur.execute("""
                    INSERT INTO formation (user_id, diplome, etablissement, date_debut, date_fin, description, lieu)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (user_id, form.diplome or '', form.etablissement or '', form.annee, None, desc, None))
                
        # Réinsère les compétences
        if profil.competences:
            for comp in profil.competences:
                for element in comp.elements:
                    cur.execute("""
                        INSERT INTO competence (user_id, nom_competence, niveau, categorie)
                        VALUES (%s, %s, %s, %s)
                    """, (user_id, element, None, comp.categorie))

        # Réinsère les projets
        if profil.projets:
            for proj in profil.projets:
                desc = "\\n".join(proj.description)
                techs = ",".join(proj.technologies)
                cur.execute("""
                    INSERT INTO projet (user_id, nom, description, technologies)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, proj.nom or '', desc, techs))

        # Réinsère les langues (parse le format "Nom — Niveau")
        if profil.langues:
            for lang in profil.langues:
                # Sépare sur le tiret cadratin " — " pour extraire nom et niveau
                parts = lang.split(' — ', 1)
                nom_langue = parts[0].strip()
                niveau = parts[1].strip() if len(parts) > 1 else None
                cur.execute("""
                    INSERT INTO langue (user_id, nom_langue, niveau)
                    VALUES (%s, %s, %s)
                """, (user_id, nom_langue, niveau))
                    
        # Valide toutes les modifications
        conn.commit()
    except Exception as e:
        # Annule en cas d'erreur
        # >>> conn.rollback() = annule TOUTES les requêtes de cette transaction
        #     (les DELETE déjà exécutés sont défaits) — évite de laisser la
        #     BDD dans un état incohérent (ex: données supprimées mais pas
        #     réinsérées si une erreur survient au milieu du processus).
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur BDD : {str(e)}")
    finally:
        # Ferme toujours le curseur et la connexion
        cur.close()
        conn.close()
        
    return {"message": "Profil mis à jour avec succès"}

# ── Modèle pour la requête d'analyse d'offre ─────────────────────────────────
class AnalyseRequest(BaseModel):
    # Texte complet de l'offre d'emploi collé par l'utilisateur
    texteOffre: str

# ── POST /analyze-offer : analyse une offre d'emploi avec l'IA ───────────────
@router.post("/analyze-offer")
def analyze_offer(data: dict, payload: dict = Depends(get_current_user)):
    """Analyse l'offre d'emploi avec l'IA."""
    # Extrait le texte de l'offre depuis le body
    texte = data.get("texteOffre")
    # Vérifie que le texte n'est pas vide
    if not texte:
        raise HTTPException(status_code=400, detail="texteOffre est requis")
        
    try:
        # Envoie le texte au pipeline IA pour analyse
        analyse = cv_pipeline.analyser_offre(texte)
        # Retourne l'analyse structurée en JSON
        return analyse.model_dump()
    except Exception as e:
        # Log le traceback complet dans la console backend
        print(f"\n{'='*60}")
        print(f"[ERREUR /analyze-offer] {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Erreur d'analyse offre: {str(e)}")

# ── POST /generate : génère le CV optimisé + lettre de motivation ────────────
# >>> C'est la route qui ORCHESTRE tout le pipeline IA : analyse offre déjà
#     faite avant, puis ici adaptation → restauration des infos perso →
#     compactage 1 page → lettre de motivation → sauvegarde BDD.
@router.post("/generate")
def generate_cv(data: dict, payload: dict = Depends(get_current_user)):
    """Génère un CV PDF optimisé.
    Accepte optionnellement 'profil' (profil extrait d'un CV importé).
    Si absent, utilise le profil enregistré en base de données."""
    # Récupère l'ID utilisateur
    user_id = get_user_id(payload["sub"])
    
    # Vérifie que l'analyse de l'offre est fournie
    analyse_data = data.get("analyseOffre")
    if not analyse_data:
        raise HTTPException(status_code=400, detail="analyseOffre est requis")
        
    try:
        # 1. Récupère le profil : depuis le frontend (CV importé) OU depuis la BDD
        profil_dict = data.get("profil")  # profil fourni par le frontend (CV importé)
        if profil_dict:
            # Utilise le profil envoyé par le frontend
            profil_model = ProfilCandidatModel(**profil_dict)
        else:
            # Sinon récupère le profil enregistré en BDD
            profil_dict = get_profil(payload)
            profil_model = ProfilCandidatModel(**profil_dict)
        # Parse l'analyse de l'offre dans le modèle Pydantic
        offre_model = AnalyseOffre(**analyse_data)
        
        # 2. L'IA adapte le CV pour correspondre à l'offre (reformule sans inventer)
        profil_optimise = cv_pipeline.adapter_cv(profil_model, offre_model)
        
        # 2.5 Force les informations personnelles depuis le profil original
        # (L'IA peut les supprimer lors de la reformulation, on les restaure)
        # >>> Mesure défensive contre l'IA : le LLM peut parfois "oublier"
        #     de reporter un champ lors de la reformulation. "or" garde la
        #     valeur de l'IA si elle existe, sinon retombe sur l'originale.
        profil_optimise.linkedin  = profil_model.linkedin  or profil_optimise.linkedin
        profil_optimise.github    = profil_model.github    or profil_optimise.github
        profil_optimise.portfolio = profil_model.portfolio or profil_optimise.portfolio
        profil_optimise.email     = profil_model.email     or profil_optimise.email
        profil_optimise.telephone = profil_model.telephone or profil_optimise.telephone
        profil_optimise.ville     = profil_model.ville     or profil_optimise.ville
        
        # 2.6 Force les liens des projets depuis le profil original
        # (L'IA peut les supprimer lors de la reformulation, on les restaure)
        if profil_model.projets and profil_optimise.projets:
            liens_projets = {p.nom: p.lien for p in profil_model.projets if p.nom and p.lien}
            for projet_opt in profil_optimise.projets:
                if projet_opt.nom and projet_opt.nom in liens_projets:
                    projet_opt.lien = liens_projets[projet_opt.nom]
        
        # 3. Boucle de vérification : force le CV à tenir sur 1 seule page A4
        # >>> Appelle l'algorithme central du projet (voir cv_pipeline.py) :
        #     génère un vrai PDF, compte les pages, resserre le CSS ou
        #     raccourcit le contenu via l'IA jusqu'à obtenir 1 page.
        profil_optimise = cv_pipeline.compacter_cv_une_page(profil_optimise, offre_model, max_tentatives=8)
        
        # 3.5 Génère la lettre de motivation personnalisée
        lettre_texte = cv_pipeline.generer_lettre_motivation(profil_model, offre_model)
        # Construit le HTML de la lettre avec l'en-tête du candidat
        html_lettre = cv_pipeline.construire_html_lettre(profil_optimise.model_dump(), lettre_texte)
        
        # 4. Génère le HTML final du CV avec le template Jinja2
        html_cv = cv_pipeline.renderiser_cv_html(profil_optimise.model_dump())
        
        # Prépare les données à sauvegarder en BDD (profil + lettre + info offre)
        contenu_db = profil_optimise.model_dump()
        contenu_db["lettre_motivation_html"] = html_lettre
        contenu_db["titre_offre"] = offre_model.titre_poste
        contenu_db["entreprise_offre"] = offre_model.entreprise
        
        # Sauvegarde une référence du CV généré dans la table cv
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO cv (user_id, format, contenu_cv, nom_fichier, chemin_fichier)
            VALUES (%s, %s, %s, %s, %s) RETURNING id_cv
        """, (user_id, 'HTML', json.dumps(contenu_db, ensure_ascii=False), 'cv.html', ''))
        conn.commit()
        cur.close()
        conn.close()
        
        # Retourne le HTML du CV, de la lettre, et le profil optimisé
        # >>> Retourne un dict brut, PAS un objet ResultatFinalModel — cette
        #     classe existe dans cv_models.py mais n'est jamais utilisée ici
        #     (vestige de conception, zone de dette technique mineure).
        return {
            "message": "CV généré avec succès",
            "html_cv": html_cv,
            "html_lettre": html_lettre,
            "profil_optimise": profil_optimise.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération: {str(e)}")

# ── GET /download/{filename} : télécharge un CV généré au format PDF ─────────
@router.get("/download/{filename}")
def download_cv(filename: str):
    """Télécharge un CV généré."""
    # Construit le chemin du fichier dans le dossier output/
    file_path = f"output/{filename}"
    # Vérifie que le fichier existe
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Fichier non trouvé")
    # Renvoie le fichier en téléchargement
    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')


# ── GET /html/{id_cv} : reconstruit le HTML d'un CV sauvegardé ───────────────
@router.get("/html/{id_cv}")
def get_cv_html(id_cv: int, payload: dict = Depends(get_current_user)):
    """Reconstruit et retourne le HTML d'un CV à partir de son ID."""
    # Récupère l'ID utilisateur pour vérifier la propriété
    user_id = get_user_id(payload["sub"])
    conn = get_db()
    cur = conn.cursor()

    # Sélectionne le contenu JSONB du CV (vérifie qu'il appartient à l'utilisateur)
    # >>> WHERE id_cv = %s AND user_id = %s — double condition essentielle :
    #     empêche un utilisateur connecté de consulter le CV d'un AUTRE
    #     utilisateur en devinant simplement son id_cv dans l'URL.
    cur.execute(
        "SELECT contenu_cv FROM cv WHERE id_cv = %s AND user_id = %s",
        (id_cv, user_id)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    # CV introuvable ou n'appartient pas à l'utilisateur
    if not row:
        raise HTTPException(status_code=404, detail="CV introuvable")

    # Extrait le contenu JSONB
    contenu = row[0]
    # Si c'est une string JSON, la parse en dict
    if isinstance(contenu, str):
        contenu = json.loads(contenu)

    # Re-rend le HTML du CV avec le template
    html_cv = cv_pipeline.renderiser_cv_html(contenu)
    # Récupère la lettre de motivation HTML si elle existe
    html_lettre = contenu.get("lettre_motivation_html", "")
    # Retourne les deux HTML
    return {"html_cv": html_cv, "html_lettre": html_lettre}


# ── GET /history : retourne l'historique des CV générés par l'utilisateur ────
@router.get("/history")
def get_history(payload: dict = Depends(get_current_user)):
    """Retourne l'historique des CV générés par l'utilisateur connecté."""
    # Récupère l'ID utilisateur
    user_id = get_user_id(payload["sub"])
    conn = get_db()
    cur = conn.cursor()

    # Sélectionne tous les CV de l'utilisateur, du plus récent au plus ancien
    cur.execute("""
        SELECT id_cv, date_generation, format, statut, nom_fichier, contenu_cv
        FROM cv
        WHERE user_id = %s
        ORDER BY date_generation DESC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Construit la liste d'historique
    history = []
    for row in rows:
        history.append({
            "id_cv": row[0],
            # Convertit la date en format ISO 8601 string
            "date_generation": row[1].isoformat() if row[1] else None,
            "format": row[2],
            "statut": row[3],
            "nom_fichier": row[4],
            "contenu_cv": row[5]
        })

    # Retourne l'historique complet
    return history