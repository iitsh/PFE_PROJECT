# Importe les modules standard : os (variables d'env), json (parsing), re (regex), time (délais), sys
import os, json, re, time, sys
# pdfplumber : extrait le texte des fichiers PDF
import pdfplumber
# Client Google Gemini pour l'IA générative
import google.generativeai as genai
# Client Groq pour les modèles Llama/Gemma (rapide et gratuit)
from groq import Groq as GroqClient
# Client OpenAI-compatible pour OpenRouter (fallback)
from openai import OpenAI
# Importe les modèles Pydantic pour la validation des données
from cv_models import ProfilCandidatModel, AnalyseOffre
# Charge les variables d'environnement depuis le fichier .env
from dotenv import load_dotenv
# Jinja2 : moteur de template pour rendre le HTML du CV
from jinja2 import Template
# Pathlib : manipulation de chemins de fichiers
from pathlib import Path
# Playwright : navigateur headless pour convertir le HTML en PDF
from playwright.sync_api import sync_playwright
# Traceback : formatage détaillé des erreurs
import traceback

# Charge les variables d'environnement (clés API, etc.)
load_dotenv()

# ── Initialise les clients IA (plusieurs fournisseurs pour le fallback) ──────
# OpenRouter : fournisseur compatible OpenAI, utilisé en dernier recours
# ── Clients IA initialisés paresseusement (lazy) ─────────────────────────────
# On ne crée pas les clients au moment de l'import (évite le crash en CI/test)
# mais à la première utilisation réelle.
_openrouter_client = None
_groq_client = None

def get_openrouter_client():
    """Retourne le client OpenRouter, initialisé à la première utilisation."""
    global _openrouter_client
    if _openrouter_client is None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY non définie. Vérifiez votre fichier .env")
        _openrouter_client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")
    return _openrouter_client

def get_groq_client():
    """Retourne le client Groq, initialisé à la première utilisation."""
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY non définie. Vérifiez votre fichier .env")
        _groq_client = GroqClient(api_key=api_key)
    return _groq_client

# ── Listes de modèles par fournisseur (ordre de priorité dans chaque liste) ──
# Gemini : pro (plus fiable) → flash (bon équilibre) → flash-lite (rapide mais tronque)
GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
# Groq : Llama 3.3 70B (le plus capable) → Llama 3.1 8B (très rapide, bon fallback)
GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
# OpenRouter : modèles gratuits en dernier recours
OPENROUTER_MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-exp:free"]

# ── Fonction universelle d'appel LLM avec fallback multi-fournisseurs ────────
# Essaie dans l'ordre : Gemini → Groq → OpenRouter
# Si un fournisseur échoue, passe au suivant automatiquement
# >>> Fonction la PLUS appelée du pipeline — toutes les autres fonctions IA
#     (analyser_cv, analyser_offre, adapter_cv, generer_lettre_motivation,
#     compacter_cv_une_page) passent par elle. C'est le point de résilience
#     central : sans budget, on dépend d'APIs gratuites avec quotas limités,
#     donc le fallback en cascade évite qu'une seule limite de quota plante
#     toute l'application.
# >>> system = les instructions permanentes ("tu es un expert CV...")
#     user = les données à traiter (texte du CV, offre d'emploi...)
#     C'est la distinction standard des modèles de chat (rôle system vs user).
def appeler_llm(system: str, user: str, max_tokens: int = 4000) -> str:
    # ── Tente d'abord les modèles Google Gemini ──
    if os.getenv("GOOGLE_API_KEY"):
        for model_name in GEMINI_MODELS:
            try:
                # Crée le modèle avec l'instruction système
                model = genai.GenerativeModel(model_name=model_name, system_instruction=system)
                # Génère la réponse avec temperature basse (0.1) pour la cohérence
                # >>> temperature contrôle le hasard de la réponse : proche de 0 = quasi
                #     déterministe et précis, proche de 1 = créatif/varié. On veut de la
                #     précision pour un parsing de CV, pas de la créativité.
                response = model.generate_content(
                    user,
                    generation_config=genai.GenerationConfig(max_output_tokens=max_tokens, temperature=0.1)
                )
                # Retourne le texte si non vide
                if response.text: return response.text
            except Exception as e:
                # Pause d'1 seconde avant de réessayer (rate limiting)
                time.sleep(1)

    # ── Tente ensuite les modèles Groq ──
    if os.getenv("GROQ_API_KEY"):
        for model_name in GROQ_MODELS:
            try:
                # Appel via l'API compatible OpenAI
                response = get_groq_client().chat.completions.create(
                    model=model_name,
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                    temperature=0.1, max_tokens=max_tokens,
                )
                # Retourne le contenu du premier choix
                if response.choices[0].message.content: return response.choices[0].message.content
            except Exception as e:
                # Pause d'1 seconde avant de réessayer
                time.sleep(1)

    # ── Tente enfin OpenRouter en dernier recours ──
    if os.getenv("OPENROUTER_API_KEY"):
        for model in OPENROUTER_MODELS:
            try:
                # Même API compatible OpenAI
                response = get_openrouter_client().chat.completions.create(
                    model=model,
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                    temperature=0.1, max_tokens=max_tokens,
                )
                # Retourne le contenu du premier choix
                if response.choices[0].message.content: return response.choices[0].message.content
            except Exception as e:
                # Pause de 2 secondes (OpenRouter a un rate limit plus strict)
                time.sleep(2)

    # Si aucun fournisseur n'a fonctionné, lève une erreur explicite
    raise RuntimeError("Tous les modèles d'IA sont indisponibles. Veuillez vérifier vos clés API.")

# ── Extrait un objet JSON depuis la réponse texte de l'IA ────────────────────
# Gère plusieurs formats : ```json{...}```, {...} brut, ou JSON direct
# >>> Le LLM répond parfois avec du texte autour du JSON (ex: "Voici le
#     résultat : ```json {...} ```"). Cette fonction essaie 3 stratégies
#     dans l'ordre, du plus structuré au plus brut, avant d'échouer.
def extraire_json(texte: str) -> dict:
    # Nettoie les espaces en début/fin
    texte = texte.strip()
    # Log la longueur de la réponse reçue
    print(f"[extraire_json] Réponse reçue : {len(texte)} caractères")
    # Essaie d'abord le format markdown ```json{...}```
    # >>> re.search() = trouve la 1ère correspondance du motif dans le texte.
    #     [\s\S]*? = "n'importe quel caractère" (y compris saut de ligne),
    #     le "?" rend la capture non-gourmande (s'arrête au 1er "```" trouvé).
    m = re.search(r"```(?:json)?\s*({[\s\S]*?})\s*```", texte)
    if m:
        # >>> m.group(1) = le contenu capturé entre les parenthèses du motif
        #     json.loads() = convertit une chaîne JSON en dict/list Python
        try: return json.loads(m.group(1))
        except json.JSONDecodeError:
            print(f"[extraire_json] Échec parsing markdown block")

    # Essaie ensuite un objet JSON {...} brut dans le texte
    m = re.search(r"({[\s\S]*})", texte)
    if m:
        try: return json.loads(m.group(1))
        except json.JSONDecodeError as e:
            print(f"[extraire_json] Échec parsing JSON brut : {e}")
            print(f"[extraire_json] Fragment trouvé ({len(m.group(1))} chars) :\n{m.group(1)[:300]}...")

    # Dernière tentative : parser le texte entier comme JSON
    try: return json.loads(texte)
    except json.JSONDecodeError as e:
        # Log COMPLET de la réponse pour diagnostic
        print(f"\n{'='*60}")
        print(f"[ERREUR JSON] Impossible de parser la réponse de l'IA")
        print(f"[ERREUR JSON] Longueur : {len(texte)} caractères")
        print(f"[ERREUR JSON] Erreur : {e}")
        print(f"[ERREUR JSON] Réponse COMPLÈTE :")
        print(texte)
        print(f"{'='*60}\n")
        raise RuntimeError("Impossible d'extraire le JSON de la réponse de l'IA")

# ── Analyse un CV (texte) et retourne un profil structuré ────────────────────
# Envoie le texte du CV à l'IA avec un prompt strict de parseur
# Retry automatique si la réponse JSON est tronquée (problème intermittent de Gemini)
def analyser_cv(texte_cv_court: str, max_tentatives: int = 3) -> ProfilCandidatModel:
    # Génère le schéma JSON attendu pour guider l'IA
    # >>> model_json_schema() = méthode Pydantic qui génère la définition
    #     exacte des champs attendus (noms, types). On l'envoie au LLM pour
    #     qu'il sache précisément quelle structure produire — du "prompt
    #     engineering" : guider l'IA avec une structure plutôt que la laisser
    #     deviner le format.
    schema_profil = json.dumps(ProfilCandidatModel.model_json_schema(), ensure_ascii=False)
    # Boucle de retry : si l'IA tronque sa réponse, on relance automatiquement
    derniere_erreur = None
    for tentative in range(1, max_tentatives + 1):
        try:
            print(f"[analyser_cv] Tentative {tentative}/{max_tentatives}...")
            # Appelle le LLM avec un prompt système très strict
            reponse_profil = appeler_llm(
                system=(
                    "Tu es un parseur de CV expert. Retourne UNIQUEMENT un objet JSON valide, sans texte autour.\n"
                    "CRITIQUE :\n"
                    "- Extrais UNIQUEMENT les informations présentes dans le CV. N'INVENTE RIEN.\n"
                    "- Si une information n'est pas dans le CV, mets null ou laisse vide.\n"
                    "- Ne devine pas l'email, le téléphone, la ville, LinkedIn, GitHub si absents.\n"
                    "- Garde les descriptions originales, ne les résume pas, ne les embellis pas.\n"
                    "- Pour les compétences : NE JAMAIS inclure d'URLs, de parenthèses isolées,\n"
                    "  de ponctuation seule, ou de fragments d'un seul caractère.\n"
                    "  Les compétences doivent être des mots ou phrases significatifs (min 2 lettres).\n"
                    "- Pour les langues : les niveaux possibles sont A1, A2, B1, B2, C1, C2,\n"
                    "  Natif, Courant, Avancé, Intermédiaire, Débutant, Élémentaire, Maternel, Bilingue.\n"
                    "  Si un niveau est présent dans le CV, inclus-le (ex: 'Français B2', 'Anglais Intermédiaire').\n"
                    "  Si aucun niveau n'est mentionné, mets juste le nom de la langue.\n"
                    "- Pour les PROJETS : si le CV original contient des liens (GitHub, démo, portfolio)\n"
                    "  associés à chaque projet, extrais-les dans le champ 'lien' de chaque projet.\n"
                    "  Exemple : {\"nom\": \"Mon Projet\", \"lien\": \"https://github.com/user/repo\", ...}"
                ),
                # Envoie le schéma JSON attendu + le texte du CV à analyser
                user=f"Schema attendu :\n{schema_profil}\n\nCV a analyser :\n{texte_cv_court}",
                max_tokens=4000
            )
            # Parse la réponse JSON et la valide via le modèle Pydantic
            # >>> ProfilCandidatModel(**dict) déballe le dict (opérateur **)
            #     et valide chaque champ selon les types définis dans
            #     cv_models.py. Si un champ est incohérent, Pydantic lève une
            #     erreur ICI, immédiatement — pas 3 étapes plus loin.
            return ProfilCandidatModel(**extraire_json(reponse_profil))
        except (RuntimeError, Exception) as e:
            derniere_erreur = e
            print(f"[analyser_cv] Tentative {tentative} échouée : {e}")
            if tentative < max_tentatives:
                print(f"[analyser_cv] Retry automatique dans 1 seconde...")
                import time
                time.sleep(1)
    # Si toutes les tentatives ont échoué, remonte la dernière erreur
    raise derniere_erreur

# ── Analyse une offre d'emploi et retourne une structure ──────────────────────
# Extrait titre, entreprise, compétences requises/souhaitées, mots-clés ATS
# Retry automatique si la réponse JSON est tronquée (problème intermittent de Gemini)
def analyser_offre(texte_offre: str, max_tentatives: int = 3) -> AnalyseOffre:
    # Log le texte envoyé pour diagnostic
    print(f"[analyser_offre] Texte de l'offre envoyé ({len(texte_offre)} caractères)")
    # Génère le schéma JSON de l'offre pour guider l'IA
    schema_offre = json.dumps(AnalyseOffre.model_json_schema(), ensure_ascii=False)
    # Boucle de retry : si l'IA tronque sa réponse, on relance automatiquement
    derniere_erreur = None
    for tentative in range(1, max_tentatives + 1):
        try:
            print(f"[analyser_offre] Tentative {tentative}/{max_tentatives}...")
            # Appelle le LLM avec un prompt d'analyste RH
            reponse_offre = appeler_llm(
                system=(
                    "Tu es un analyste RH expert. Retourne UNIQUEMENT un objet JSON valide.\n"
                    "CRITIQUE — extrais OBLIGATOIREMENT :\n"
                    "- titre_poste : le titre exact du poste (ex: 'Développeur Full Stack', 'Data Scientist').\n"
                    "  Cherche-le dans le titre de l'offre ou la première ligne. JAMAIS null ou vide.\n"
                    "- entreprise : nom de l'entreprise. Si absent, mets 'Non spécifié'.\n"
                    "- type_contrat : CDI / CDD / Stage / Alternance / Freelance. Si absent, mets 'Non spécifié'.\n"
                    "- niveau : niveau requis (Junior, Senior, Bac+5, etc.). Si absent, mets 'Non spécifié'.\n"
                    "\n"
                    "RÈGLES STRICTES POUR LES COMPÉTENCES :\n"
                    "- competences_requises : EXTRAIS EXACTEMENT ce qui est écrit dans la section 'Profil recherché',\n"
                    "  'Vos compétences', 'Prérequis' ou équivalent.\n"
                    "  • Chaque compétence doit être un élément séparé et précis (ex: 'Python', pas 'Langages de programmation').\n"
                    "  • Inclus les langages, frameworks, bibliothèques, bases de données, méthodologies.\n"
                    "  • EXCLUS les simples outils/IDE/logiciels : Maven, Gradle, IntelliJ, VS Code, Figma,\n"
                    "    Jira, Confluence, Postman, Swagger, Docker, Git, etc. ne sont PAS des compétences.\n"
                    "  • INTERDICTION FORMELLE d'inventer une compétence qui n'est PAS écrite dans l'offre.\n"
                    "  • Si tu hésites sur une compétence, NE LA METS PAS.\n"
                    "  • Ne généralise JAMAIS : si l'offre dit 'Spring Boot', écris 'Spring Boot', pas 'Java'.\n"
                    "  • Si une compétence est listée comme 'obligatoire', 'requis', 'maîtrise de', mets-la ici.\n"
                    "\n"
                    "- competences_souhaitees : EXTRAIS EXACTEMENT ce qui est marqué comme 'un plus', 'apprécié',\n"
                    "  'serait un avantage', 'nice to have' ou équivalent.\n"
                    "  • Même règle de précision : chaque compétence est un élément séparé et exact.\n"
                    "  • Si aucune compétence n'est marquée comme 'un plus', retourne une liste vide [].\n"
                    "  • Ne mélange pas avec les compétences requises.\n"
                    "\n"
                    "- mots_cles_ats : tous les mots-clés techniques (technologies, méthodologies, certifications)\n"
                    "  qui aideront le CV à passer les filtres automatiques (ATS).\n"
                    "\n"
                    "Sois PRÉCIS et FIDÈLE au texte de l'offre. N'ajoute AUCUNE compétence qui n'est pas explicitement écrite dans l'offre."
                ),
                # Envoie le schéma + le texte de l'offre
                user="Schema attendu :\n" + schema_offre + "\n\nOffre d'emploi :\n" + texte_offre,
                max_tokens=4096
            )
            # Parse et valide la réponse via le modèle Pydantic AnalyseOffre
            return AnalyseOffre(**extraire_json(reponse_offre))
        except (RuntimeError, Exception) as e:
            derniere_erreur = e
            print(f"[analyser_offre] Tentative {tentative} échouée : {e}")
            if tentative < max_tentatives:
                print(f"[analyser_offre] Retry automatique dans 1 seconde...")
                import time
                time.sleep(1)
    # Si toutes les tentatives ont échoué, remonte la dernière erreur
    raise derniere_erreur

# ── Adapte le CV du candidat pour correspondre à l'offre d'emploi ─────────────
# L'IA reformule les descriptions et réordonne sans inventer de contenu
# >>> C'est la fonction la plus sensible éthiquement du pipeline : la règle
#     "sous-ensemble exact des compétences du CV original" garantit que le
#     système ne fabrique jamais de fausses compétences pour matcher
#     artificiellement une offre.
def adapter_cv(profil: ProfilCandidatModel, offre: AnalyseOffre) -> ProfilCandidatModel:
    # Génère le schéma JSON du profil pour la réponse
    schema_profil = json.dumps(ProfilCandidatModel.model_json_schema(), ensure_ascii=False)
    # Appelle le LLM avec un prompt de rédacteur CV expert
    reponse_cv = appeler_llm(
        system=(
            "Tu es un expert RH et rédacteur de CV. Retourne UNIQUEMENT un objet JSON valide.\n"
            "CRITIQUE :\n"
            "- NE JAMAIS inventer d'expériences, de compétences ou de projets.\n"
            "- Adapte UNIQUEMENT la formulation et l'ordre des informations existantes.\n"
            "- Ne supprime aucune expérience ni aucun projet.\n"
            "- Reformule les descriptions pour faire ressortir les mots-clés de l'offre,\n"
            "  mais sans ajouter des faits qui ne sont pas dans le CV original.\n"
            "- INTERDICTION FORMELLE d'ajouter une compétence qui n'est PAS dans le CV original.\n"
            "  Même si l'offre la demande, si le candidat ne l'a pas, NE L'AJOUTE PAS.\n"
            "- La liste des compétences finales doit être un SOUS-ENSEMBLE exact des compétences\n"
            "  du CV original. Tu peux reformuler mais JAMAIS ajouter de nouvelles compétences.\n"
            "- CONCISION OBLIGATOIRE : le CV final doit tenir sur 1 seule page A4.\n"
            "  • Chaque description d'expérience : max 2-3 puces, chaque puce max 1 ligne courte.\n"
            "  • Chaque description de projet : max 2 puces, chaque puce max 1 ligne courte.\n"
            "  • Résumé professionnel : max 3 lignes.\n"
            "  • Formations : pas de description, juste le diplôme + école + année.\n"
            "  • Supprime les mots de liaison inutiles, les répétitions, les détails superflus.\n"
            "  • Privilégie les verbes d'action et les résultats chiffrés.\n"
            "- NE SUPPRIME JAMAIS les champs : email, telephone, ville, linkedin, github, portfolio.\n"
            "  Recopie-les EXACTEMENT comme dans le profil original.\n"
            "- Pour les PROJETS : recopie EXACTEMENT le champ 'lien' de chaque projet.\n"
            "  Ne supprime jamais les liens GitHub/démo associés aux projets."
        ),
        # Envoie le profil original + l'analyse de l'offre + le schéma attendu
        user=f"Profil candidat original :\n{profil.model_dump_json(indent=2)}\n\nAnalyse de l'offre :\n{offre.model_dump_json(indent=2)}\n\nSchema attendu :\n{schema_profil}",
        max_tokens=8000
    )
    # Parse et valide le profil optimisé
    return ProfilCandidatModel(**extraire_json(reponse_cv))

# ── Génère une lettre de motivation personnalisée ─────────────────────────────
# Utilise le profil candidat et l'offre d'emploi pour adapter le contenu
def generer_lettre_motivation(profil: ProfilCandidatModel, offre: AnalyseOffre) -> str:
    # Appelle le LLM avec un prompt de rédacteur de lettres
    reponse_lettre = appeler_llm(
        system=(
            "Tu es un expert en rédaction de lettres de motivation.\n"
            "Rédige une lettre de motivation professionnelle de 200 à 300 mots.\n"
            "Adapte le contenu au profil du candidat et à l'offre d'emploi.\n"
            "Retourne UNIQUEMENT le texte de la lettre, sans JSON, sans titre, sans mise en forme.\n"
            "Ne mets pas les coordonnées en haut (elles seront gérées par le design).\n"
            "IMPORTANT : Termine TOUJOURS par une formule de politesse complète (ex: 'Veuillez agréer...')\n"
            "suivie de la signature. Ne coupe JAMAIS ta réponse en plein milieu d'une phrase."
        ),
        # Envoie le profil et l'offre pour personnalisation
        user=f"Profil candidat :\n{profil.model_dump_json(indent=2)}\n\nOffre d'emploi :\n{offre.model_dump_json(indent=2)}",
        max_tokens=4096
    )
    lettre = reponse_lettre.strip()
    # Vérifie si la lettre semble tronquée (ne se termine pas par une ponctuation de fin)
    if lettre and not lettre[-1] in '.!?:':
        print(f"[ATTENTION] Lettre possiblement tronquée. Derniers 100 caractères :\n...{lettre[-100:]}")
    return lettre

# ── Lit un fichier PDF et retourne tout le texte extrait ──────────────────────
# >>> AUCUNE IA ici — extraction MÉCANIQUE via pdfplumber. C'est une étape
#     gratuite et déterministe, distincte de analyser_cv() qui elle utilise
#     l'IA pour STRUCTURER ce texte brut en JSON.
def lire_pdf(pdf_bytes: bytes) -> str:
    # Import local pour éviter le chargement au démarrage
    import io
    # Initialise le texte accumulé
    texte = ""
    # Ouvre le PDF depuis les bytes en mémoire (pas de fichier temporaire)
    # >>> io.BytesIO() = traite des bytes comme un fichier, évite d'écrire
    #     un fichier temporaire sur le disque juste pour le lire.
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        # Parcourt chaque page du PDF
        for page in pdf.pages:
            # Extrait le texte de la page
            # >>> extract_text() = méthode pdfplumber qui reconstitue le texte
            #     dans l'ordre de lecture (gère colonnes, tableaux simples).
            t = page.extract_text()
            # Ajoute le texte s'il existe
            if t: texte += t + "\n"
    # Retourne le texte complet nettoyé
    return texte.strip()

# ── Niveaux CSS de resserrement progressif pour forcer le CV sur 1 page ──────
# Niveau 0 : pas de CSS supplémentaire (taille normale)
# Niveau 1 : padding et espacements légèrement réduits
# Niveau 2 : tailles de police et marges réduites davantage
# Niveau 3 : resserrement maximum (polices très petites)
# >>> Stratégie "gratuite" : resserrer le CSS coûte 0 appel API, contrairement
#     au raccourcissement du contenu par l'IA (voir compacter_cv_une_page).
#     On essaie d'abord la solution non-destructive et sans coût.
TIGHTENING_CSS = {
    0: "", 
    1: '<style>\n  .col-left  { padding: 15px 12px !important; gap: 8px !important; }\n  .col-right { padding: 15px 15px !important; }\n  .right-item-bloc { margin-bottom: 8px !important; line-height: 1.35 !important; }\n  .section-right-title { margin-bottom: 6px !important; padding: 4px !important; }\n  .section-left-title  { margin-bottom: 6px !important; padding: 4px !important; }\n  .header h2 { margin-bottom: 6px !important; }\n  ul li { margin-bottom: 1px !important; }\n</style>', 
    2: '<style>\n  .col-left  { padding: 12px 10px !important; gap: 6px !important; }\n  .col-right { padding: 12px 12px !important; }\n  .right-item-bloc { margin-bottom: 6px !important; font-size: 11px !important; line-height: 1.3 !important; }\n  .right-item-bloc strong { font-size: 12px !important; margin-bottom: 0 !important; }\n  .right-item-bloc .subtitle2 { margin-bottom: 3px !important; }\n  .section-right-title { margin-bottom: 5px !important; padding: 3px !important; font-size: 11px !important; }\n  .section-left-title  { margin-bottom: 5px !important; padding: 3px !important; font-size: 11px !important; }\n  .section-content { font-size: 10px !important; line-height: 1.3 !important; }\n  ul li { margin-bottom: 0 !important; }\n  .technos { margin-top: 1px !important; }\n</style>',
    3: '<style>\n  .col-left  { padding: 10px 8px !important; gap: 4px !important; }\n  .col-right { padding: 10px 10px !important; }\n  .header h1 { font-size: 18px !important; }\n  .header h2 { font-size: 10px !important; margin-bottom: 4px !important; }\n  .contact-info { font-size: 9px !important; line-height: 1.4 !important; }\n  .contact-info li { margin-bottom: 1px !important; }\n  .right-item-bloc { margin-bottom: 4px !important; font-size: 10px !important; line-height: 1.25 !important; }\n  .right-item-bloc strong { font-size: 11px !important; margin-bottom: 0 !important; }\n  .right-item-bloc .subtitle2 { margin-bottom: 2px !important; font-size: 9px !important; }\n  .section-right-title { margin-bottom: 4px !important; padding: 3px !important; font-size: 10px !important; }\n  .section-left-title  { margin-bottom: 4px !important; padding: 3px !important; font-size: 10px !important; }\n  .section-content { font-size: 9px !important; line-height: 1.25 !important; }\n  .item-bloc { margin-bottom: 4px !important; }\n  .item-bloc strong { font-size: 10px !important; }\n  .item-bloc .subtitle { font-size: 9px !important; }\n  ul { padding-left: 10px !important; }\n  ul li { margin-bottom: 0 !important; font-size: 9px !important; }\n  .technos { margin-top: 1px !important; font-size: 9px !important; }\n  .langue-item { margin-bottom: 1px !important; font-size: 9px !important; }\n</style>'
}

# ── Rend le CV en HTML en utilisant le template Jinja2 ────────────────────────
def renderiser_cv_html(profil_d: dict, tightening: int = 0) -> str:
    # Extrait le titre du poste depuis la première expérience (si existante)
    job_title = (
        profil_d.get("experiences")
        and profil_d["experiences"]
        and profil_d["experiences"][0].get("titre")
    ) or None
    # Charge le template HTML depuis le fichier template_cv.html
    # >>> Path().read_text() = lit le fichier brut, avec ses {{ variables }}
    #     Jinja2 pas encore remplacées.
    template_html = Path("template_cv.html").read_text(encoding="utf-8")
    # Rend le template avec toutes les données du profil
    # >>> Template(html).render(**kwargs) = méthode Jinja2 qui remplace
    #     chaque {{ variable }} du template par sa vraie valeur Python.
    #     C'est ce qui transforme le squelette HTML en CV concret.
    html = Template(template_html).render(
        nom=profil_d.get("nom", ""),
        prenom=profil_d.get("prenom", ""),
        email=profil_d.get("email", ""),
        telephone=profil_d.get("telephone", ""),
        ville=profil_d.get("ville", ""),
        linkedin=profil_d.get("linkedin", ""),
        github=profil_d.get("github", ""),
        portfolio=profil_d.get("portfolio", ""),
        resume=profil_d.get("resume", ""),
        experiences=profil_d.get("experiences", []),
        formations=profil_d.get("formations", []),
        competences=profil_d.get("competences", []),
        projets=profil_d.get("projets", []),
        langues=profil_d.get("langues", []),
        job_title=job_title,
    )
    # Injecte le CSS de resserrement au placeholder prévu dans le template
    html = html.replace("<!-- TIGHTENING_PLACEHOLDER -->", TIGHTENING_CSS.get(tightening, ""))
    # Retourne le HTML final complet
    return html

# ── Construit le HTML de la lettre de motivation ──────────────────────────────
# Crée une page HTML simple avec en-tête et paragraphes de la lettre
def construire_html_lettre(profil_d: dict, lettre: str) -> str:
    # Retourne vide si aucune lettre n'a été générée
    if not lettre:
        return ""
    # Convertit chaque ligne non vide en paragraphe HTML <p>
    paragraphs = "".join(f"<p>{p.strip()}</p>" for p in lettre.split("\n") if p.strip())
    # Construit le HTML complet avec styles inline
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Lettre de Motivation</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: white; margin: 0; padding: 40px; color: #333; line-height: 1.6; font-size: 14px; }}
        .header {{ border-bottom: 2px solid #0f344a; padding-bottom: 20px; margin-bottom: 30px; }}
        h1 {{ margin: 0; font-size: 24px; color: #0f344a; text-transform: uppercase; }}
        .contact {{ font-size: 12px; color: #666; margin-top: 5px; }}
        p {{ margin-bottom: 15px; text-align: justify; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{profil_d.get("nom", "")} {profil_d.get("prenom", "")}</h1>
        <div class="contact">
            {profil_d.get("email", "")} | {profil_d.get("telephone", "")} | {profil_d.get("ville", "")}
        </div>
    </div>
    <div class="content">
        {paragraphs}
    </div>
</body>
</html>
"""

# ── Convertit un HTML en PDF via Playwright (navigateur headless Chromium) ────
# >>> Playwright lance un vrai navigateur Chromium invisible (headless) qui
#     charge le HTML comme une vraie page web et l'imprime en PDF. C'est la
#     seule façon d'obtenir un PDF identique à ce qu'on voit dans le
#     navigateur (polices web, CSS complexe, couleurs).
def generer_pdfs(html_cv: str, pdf_path: str) -> None:
    # Crée le dossier output s'il n'existe pas
    os.makedirs("output", exist_ok=True)
    # Chemin du fichier HTML temporaire
    html_path = f"output/temp_{os.path.basename(pdf_path)}.html"
    # Écrit le HTML dans le fichier temporaire
    Path(html_path).write_text(html_cv, encoding="utf-8")
    
    try:
        # Lance un navigateur Chromium en mode headless
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            # Ouvre une nouvelle page
            page = browser.new_page()
            # Navigue vers le fichier HTML local
            page.goto(Path(html_path).resolve().as_uri())
            # Exporte en PDF format A4 avec marges à 0 (le CSS gère les marges)
            page.pdf(path=pdf_path, format="A4", print_background=True,
                     margin={"top":"0","bottom":"0","left":"0","right":"0"})
            # Ferme le navigateur
            browser.close()
    except Exception as e:
        # Supprime le fichier temporaire en cas d'erreur
        Path(html_path).unlink(missing_ok=True)
        # Relève l'erreur avec le traceback complet pour le debug
        raise RuntimeError(f"Erreur Playwright:\n{traceback.format_exc()}")
        
    # Supprime le fichier HTML temporaire après succès
    Path(html_path).unlink(missing_ok=True)


# ── Boucle de vérification : force le CV à tenir sur 1 seule page A4 ─────────
# Stratégie en 2 phases :
#   Phase 1 (tightening 0→3) : resserre le CSS sans modifier le contenu
#   Phase 2 (si CSS ne suffit pas) : demande à l'IA de raccourcir les descriptions
# >>> C'EST LA FONCTION LA PLUS IMPORTANTE DU PROJET — l'algorithme central
#     à savoir expliquer en détail au jury. Logique exacte :
#     1. Génère un VRAI PDF via Playwright et compte ses pages avec pdfplumber.
#     2. Si 1 page → succès, sortie immédiate.
#     3. Si CSS pas encore au max (tightening < 3) → resserre le CSS,
#        REBOUCLE SANS APPELER L'IA (gratuit).
#     4. Si CSS déjà au max ET toujours >1 page → appelle l'IA pour
#        raccourcir le contenu, reboucle avec le profil raccourci.
#     5. Après 10 tentatives max → sortie forcée, garde le résultat tel quel.
def compacter_cv_une_page(profil: ProfilCandidatModel, offre: AnalyseOffre, max_tentatives: int = 10) -> ProfilCandidatModel:
    """
    Boucle de vérification : raccourcit le CV jusqu'à ce qu'il tienne sur 1 page A4.
    Stratégie progressive :
    1. D'abord resserrer le CSS (niveaux 1→3) sans toucher au contenu.
    2. Seulement si le CSS ne suffit pas, demander à l'IA de raccourcir les descriptions.
    """
    # Import local de pdfplumber pour vérifier le nombre de pages
    import pdfplumber as _pdfplumber
    # Schéma JSON du profil pour les demandes de raccourcissement à l'IA
    schema_profil = json.dumps(ProfilCandidatModel.model_json_schema(), ensure_ascii=False)
    # Profil courant qui sera modifié au fil des tentatives
    profil_courant = profil
    # Niveau de resserrement CSS (commence à 0 = pas de resserrement)
    tightening = 0
    
    # Log de démarrage
    print(f"[1-page] Démarrage boucle (max {max_tentatives} tentatives)...")
    
    # Boucle sur le nombre maximum de tentatives
    for tentative in range(1, max_tentatives + 1):
        # Rend le CV en HTML avec le niveau de resserrement actuel
        html_cv = renderiser_cv_html(profil_courant.model_dump(), tightening)
        # Chemin du PDF temporaire pour la vérification
        pdf_path = "output/cv_check.pdf"
        # Crée le dossier output si nécessaire
        os.makedirs("output", exist_ok=True)
        
        try:
            # Génère le PDF pour vérifier le nombre de pages
            generer_pdfs(html_cv, pdf_path)
        except Exception as e:
            # Si la génération PDF échoue, sort de la boucle
            print(f"[1-page] Erreur PDF tentative {tentative}: {e}")
            break
        
        try:
            # Ouvre le PDF et compte le nombre de pages
            with _pdfplumber.open(pdf_path) as pdf:
                nb_pages = len(pdf.pages)
                # Si le CV déborde sur une 2e page, analyse le contenu débordant
                if nb_pages > 1:
                    texte_p2 = pdf.pages[1].extract_text() or ""
                    # Compte les caractères et lignes sur la page 2
                    chars_p2 = len(texte_p2.strip())
                    lignes_p2 = len([l for l in texte_p2.split("\n") if l.strip()])
                else:
                    # Pas de débordement
                    texte_p2 = ""; chars_p2 = lignes_p2 = 0
        except Exception as e:
            # Si la lecture PDF échoue, sort de la boucle
            print(f"[1-page] Erreur lecture PDF tentative {tentative}: {e}")
            break
        
        # Message de log avec les détails de la tentative
        extra = f" (page 2: {chars_p2} chars, {lignes_p2} lignes)" if nb_pages > 1 else ""
        print(f"[1-page] Tentative {tentative}/{max_tentatives} → {nb_pages} page(s), tightening={tightening}{extra}")
        # >>> chars_p2 mesure le débordement sur la page 2 — utilisé plus
        #     bas pour adapter l'agressivité de l'instruction donnée à l'IA :
        #     un léger débordement (<200 chars) reçoit une instruction douce,
        #     un vrai débordement reçoit une instruction agressive. L'effort
        #     demandé à l'IA est proportionnel au problème réel.
        
        # ── Succès : le CV tient sur 1 seule page ──
        if nb_pages == 1:
            print(f"[1-page] CV tient sur 1 page après {tentative} tentative(s).")
            break
        
        # ── Échec : nombre maximum de tentatives atteint ──
        if tentative == max_tentatives:
            print(f"[1-page] Max tentatives atteint. Résultat gardé.")
            break
        
        # ── Phase 1 : resserre le CSS d'abord (niveaux 0→1→2→3) ──
        if tightening < 3:
            tightening += 1
            print(f"[1-page] CSS tightening → niveau {tightening}")
            # Passe à la tentative suivante sans modifier le contenu
            continue
        
        # ── Phase 2 : CSS max atteint → demande à l'IA de raccourcir ──
        # Instruction par défaut : raccourcissement agressif
        instruction = (
            "Raccourcis AGRESSIVEMENT les descriptions : "
            "chaque puce = 1 ligne courte max (60 caractères). "
            "Fusionne les puces similaires. Supprime les détails non essentiels. "
            "Garde uniquement : titre, entreprise, technos clés, résultat chiffré si présent."
        )
        # Si le débordement est faible (<200 chars), instruction plus douce
        if chars_p2 < 200:
            instruction = (
                "Le CV déborde légèrement. Réduis chaque description de projet "
                "à 1-2 puces maximum. Fusionne les puces redondantes."
            )
        
        # Log avant l'appel IA
        print(f"[1-page] Appel IA raccourcissement (page 2: {chars_p2} chars)...")
        # Appelle le LLM pour raccourcir le profil
        reponse = appeler_llm(
            system=(
                f"CV fait {nb_pages} pages. Texte page 2 :\n---\n{texte_p2[:2000]}\n---\n"
                f"({chars_p2} chars, {lignes_p2} lignes). Objectif : 1 page A4.\n"
                f"{instruction}\n"
                "RÈGLES : Conserve TOUTES les expériences et projets. "
                "Garde infos clés (technos, chiffres). Formulations courtes.\n"
                "Retourne UNIQUEMENT le profil JSON mis à jour."
            ),
            # Envoie le profil actuel + le schéma pour la réponse
            user=("Profil à raccourcir :\n" + profil_courant.model_dump_json() +
                  "\n\nSchema :\n" + schema_profil),
            max_tokens=4000
        )
        # Met à jour le profil avec la version raccourcie par l'IA
        profil_courant = ProfilCandidatModel(**extraire_json(reponse))
    
    # Retourne le profil final (qui devrait tenir sur 1 page)
    return profil_courant