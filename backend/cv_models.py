from pydantic import BaseModel, Field, field_validator
# BeforeValidator = transforme une valeur AVANT que Pydantic ne la valide
from pydantic.functional_validators import BeforeValidator
from typing import List, Optional, Annotated


# Le LLM renvoie parfois une string "React, Node.js" au lieu d'une liste
# Cette fonction la convertit automatiquement en ["React", "Node.js"]
def _coerce_list(v):
    if isinstance(v, str):
        # split(',') = découpe par virgule, strip() = enlève les espaces,
        # le "if s.strip()" filtre les éléments vides
        return [s.strip() for s in v.split(',') if s.strip()]
    return v or []  # garde la liste si déjà correcte, [] si None

# Annotated + BeforeValidator = applique _coerce_list AVANT toute validation
# StrList se comporte comme List[str] mais tolère aussi une string en entrée
StrList = Annotated[List[str], BeforeValidator(_coerce_list)]


# Une expérience professionnelle = un élément de la liste experiences
# de ProfilCandidatModel (relation d'AGRÉGATION)
class ExperienceModel(BaseModel):
    id_experience: Optional[int] = None
    titre:       Optional[str]  = None
    entreprise:  Optional[str]  = None
    duree:       Optional[str]  = None
    lieu:        Optional[str]  = None
    description: StrList        = []   # liste de puces décrivant les missions


# Une formation = un élément de la liste formations
class FormationModel(BaseModel):
    id_formation: Optional[int] = None
    diplome:       Optional[str] = None
    etablissement: Optional[str] = None
    annee:         Optional[str] = None
    description:   StrList       = []


# Un projet = un élément de la liste projets
class ProjetModel(BaseModel):
    nom:          Optional[str] = None
    lien:         Optional[str] = None   # GitHub, démo...
    description:  StrList       = []
    technologies: StrList       = []


# Compétences regroupées PAR CATÉGORIE (pas une simple liste plate)
# ex: {categorie: "Langages", elements: ["Python", "Java"]}
class GroupeCompetenceModel(BaseModel):
    id_competence: Optional[int] = None
    categorie: str              # champ obligatoire, pas Optional
    elements:  StrList = []


# Modèle métier central — représente TOUT le CV du candidat
# Agrège experiences/formations/competences/projets (relation 1 → *)
class ProfilCandidatModel(BaseModel):
    prenom:      Optional[str]                    = None
    nom:         Optional[str]                    = None
    email:       Optional[str]                    = None
    telephone:   Optional[str]                    = None
    ville:       Optional[str]                    = None
    linkedin:    Optional[str]                    = None
    github:      Optional[str]                    = None
    portfolio:   Optional[str]                    = None
    resume:      Optional[str]                    = None
    # List[ExperienceModel] = liste d'objets typés, pas juste des dicts
    experiences: Optional[List[ExperienceModel]]       = []
    formations:  Optional[List[FormationModel]]        = []
    competences: Optional[List[GroupeCompetenceModel]] = []
    projets:     Optional[List[ProjetModel]]           = []
    langues:     StrList                          = []


# Résultat structuré que l'IA produit en analysant le texte de l'offre
# Field(None, description=...) = valeur par défaut + doc visible dans Swagger
class AnalyseOffre(BaseModel):
    titre_poste:            Optional[str] = Field(None,
        description="Intitulé exact du poste proposé")
    entreprise:             Optional[str] = Field(None,
        description="Nom de l'entreprise qui recrute")
    type_contrat:           Optional[str] = Field(None,
        description="Type de contrat uniquement : CDI, CDD, Stage, Alternance, Freelance")
    niveau:                 Optional[str] = Field(None,
        description="Niveau d'études requis uniquement : Bac+2, Bac+3, Bac+5, Master, Doctorat, etc.")
    # Field(default=[], ...) = équivalent à "= []" mais avec documentation Swagger
    competences_requises:   StrList = Field(default=[],
        description="Compétences obligatoires mentionnées dans l'offre")
    competences_souhaitees: StrList = Field(default=[],
        description="Compétences optionnelles ou souhaitées (un plus)")
    # ATS = Applicant Tracking System, logiciel RH qui filtre les CV par mots-clés
    mots_cles_ats:          StrList = Field(default=[],
        description="Tous les mots-clés techniques importants pour l'ATS")
    resume:                 Optional[str] = Field(None,
        description="Résumé court de l'offre en 1-2 phrases")


# Conteneur du résultat final — définie mais NON UTILISÉE dans routes/cv.py
# (la route /generate retourne un dict brut, pas cet objet)
class ResultatFinalModel(BaseModel):
    profil_original:   Optional[ProfilCandidatModel] = None
    profil_optimise:   Optional[ProfilCandidatModel] = None
    analyse_offre:     Optional[AnalyseOffre]   = None
    lettre_motivation: Optional[str]            = None