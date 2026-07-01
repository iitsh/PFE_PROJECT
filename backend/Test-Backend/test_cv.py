"""
Tests unitaires pour les routes CV (routes/cv.py).
Utilise pytest + FastAPI TestClient avec mock de la base de données et du pipeline IA.
Couvre : analyse d'offre, génération de CV, historique, parsing de PDF,
 récupération de profil, gestion des tokens invalides.
"""
# Import de pytest pour les fixtures et assertions
import pytest
# Import des outils de mock : patch pour remplacer des fonctions, MagicMock pour simuler
from unittest.mock import patch, MagicMock
# Import du client de test FastAPI pour envoyer des requêtes HTTP simulées
from fastapi.testclient import TestClient
# Import de l'application FastAPI principale
from main import app
# Import de la bibliothèque JWT pour créer des tokens dans les tests
import jwt
# Import du module os pour manipuler les variables d'environnement
import os
# Import des outils de date pour gérer les tokens expirés
from datetime import datetime, timedelta

# ── Client de test FastAPI : simule un client HTTP ──
client = TestClient(app)

# ── Configuration JWT pour les tests (mêmes valeurs que dans mock_env) ─────
JWT_KEY = "test-secret-key-12345"  # Clé secrète de test
JWT_ALGORITHM = "HS256"  # Algorithme HMAC-SHA256
JWT_ISSUER = "backend"  # Émetteur attendu
JWT_AUDIENCE = "pfe_frontend"  # Audience attendue


def generer_token(email="rayane@test.com"):
    """Génère un access token JWT valide pour les tests.
    Le token contient les claims standards : sub (sujet), jti (ID unique),
    iat (émis à), exp (expiration), iss (émetteur), aud (audience)."""
    now = datetime.utcnow()  # Timestamp actuel
    return jwt.encode({
        "sub": email, "name": email,  # Sujet = email de l'utilisateur
        "jti": "test-jti-123",  # ID unique du token
        "iat": int(now.timestamp()),  # Date d'émission
        "exp": now + timedelta(minutes=5),  # Expire dans 5 minutes
        "iss": JWT_ISSUER, "aud": JWT_AUDIENCE, "nbf": now  # Émetteur, audience, pas avant
    }, JWT_KEY, algorithm=JWT_ALGORITHM)


def headers_auth(token=None):
    """Retourne les headers Authorization avec un Bearer token.
    Si aucun token n'est fourni, en génère un automatiquement."""
    if token is None:
        token = generer_token()  # Génère un token par défaut
    return {"Authorization": f"Bearer {token}"}  # Format standard OAuth2


# ── Fixtures : objets partagés entre les tests ────────────────────────────

@pytest.fixture(autouse=True)
def mock_env():
    """S'assure que les variables JWT sont définies pour les tests.
    Les valeurs sont lues dynamiquement via os.getenv() dans le module auth
    (lazy initialization) — patch.dict(os.environ, ...) suffit."""
    with patch.dict(os.environ, {
        "JWT_KEY": JWT_KEY,
        "JWT_ALGORITHM": JWT_ALGORITHM,
        "JWT_ISSUER": JWT_ISSUER,
        "JWT_AUDIENCE": JWT_AUDIENCE,
        "JWT_DURATION_IN_MINUTES": "5",
        "JWT_REFRESH_TOKEN_DURATION_IN_MINUTES": "15",
    }):
        yield  # Exécute le test — os.environ est automatiquement restauré après


@pytest.fixture
def mock_db():
    """Mock la connexion DB pour les routes CV et auth.
    Patch les deux modules car les routes CV utilisent aussi l'auth."""
    with patch("routes.cv.get_db") as mock_cv,             patch("routes.auth.get_db") as mock_auth:
        conn = MagicMock()  # Simule la connexion BDD
        cur = MagicMock()  # Simule le curseur SQL
        conn.cursor.return_value = cur
        mock_cv.return_value = conn  # get_db() du module cv
        mock_auth.return_value = conn  # get_db() du module auth
        yield conn, cur


# ══════════════════════════════════════════════════════════════════════════════
# ANALYSE D'OFFRE — POST /api/cv/analyze-offer
# Teste l'extraction automatique des compétences depuis une offre d'emploi
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalyzeOffer:
    """Tests pour la route d'analyse d'offre d'emploi."""

    @patch("routes.cv.cv_pipeline")  # Mock le pipeline IA
    def test_analyse_reussie(self, mock_pipeline, mock_db):
        """L'analyse d'une offre valide retourne les résultats de l'IA."""
        # Simule le retour de l'IA avec un objet MagicMock
        mock_analyse = MagicMock()
        mock_analyse.model_dump.return_value = {
            "titre_poste": "Développeur Full Stack",  # Poste identifié
            "entreprise": "TechCorp",  # Entreprise extraite
            "type_contrat": "CDI",  # Type de contrat
            "niveau": "Mid-level",  # Niveau d'expérience
            "competences_requises": ["React", "Node.js"],  # Compétences obligatoires
            "competences_souhaitees": ["Docker", "AWS"],  # Compétences bonus
        }
        mock_pipeline.analyser_offre.return_value = mock_analyse  # Configure le mock

        # Envoie la requête d'analyse avec un texte d'offre
        res = client.post("/api/cv/analyze-offer",
                          json={"texteOffre": "Nous recherchons un développeur Full Stack..."},
                          headers=headers_auth())  # Authentifié avec JWT

        # Vérifie les résultats
        assert res.status_code == 200
        data = res.json()
        assert data["titre_poste"] == "Développeur Full Stack"
        assert data["entreprise"] == "TechCorp"
        assert "React" in data["competences_requises"]

    def test_analyse_sans_texte(self, mock_db):
        """L'analyse sans texte d'offre retourne une erreur 400."""
        res = client.post("/api/cv/analyze-offer",
                          json={"texteOffre": ""},  # Texte vide = invalide
                          headers=headers_auth())
        assert res.status_code == 400
        assert "requis" in res.json()["detail"].lower()

    def test_analyse_sans_auth(self):
        """L'analyse sans token d'authentification retourne 403."""
        res = client.post("/api/cv/analyze-offer",
                          json={"texteOffre": "Offre de test"})  # Pas de header Authorization
        assert res.status_code == 403  # Forbidden

    @patch("routes.cv.cv_pipeline")
    def test_analyse_erreur_ia(self, mock_pipeline, mock_db):
        """Une erreur de l'IA retourne une erreur 500 (serveur)."""
        mock_pipeline.analyser_offre.side_effect = Exception("Erreur IA")  # Simule un crash

        res = client.post("/api/cv/analyze-offer",
                          json={"texteOffre": "Offre de test"},
                          headers=headers_auth())
        assert res.status_code == 500  # Erreur interne du serveur
        assert "Erreur" in res.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# GÉNÉRATION DE CV — POST /api/cv/generate
# Teste la création d'un CV personnalisé à partir du profil + analyse
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateCV:
    """Tests pour la route de génération de CV."""

    @patch("routes.cv.cv_pipeline")  # Mock tout le pipeline IA
    def test_generation_reussie(self, mock_pipeline, mock_db):
        """La génération d'un CV avec profil importé réussit (code 200)."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)  # Simule get_user_id -> ID=1
        cur.fetchone.side_effect = [(1,), (1,)]  # get_user_id + INSERT RETURNING

        # Simule les retours successifs du pipeline IA
        mock_profil = MagicMock()
        mock_profil.model_dump.return_value = {
            "nom": "Berrada", "prenom": "Rayane",
            "email": "rayane@test.com", "telephone": "0612345678",
        }
        mock_pipeline.adapter_cv.return_value = mock_profil  # Adaptation du profil
        mock_pipeline.compacter_cv_une_page.return_value = mock_profil  # Compactage 1 page
        mock_pipeline.generer_lettre_motivation.return_value = "Lettre de motivation..."  # Lettre
        mock_pipeline.construire_html_lettre.return_value = "Lettre"  # HTML lettre
        mock_pipeline.renderiser_cv_html.return_value = "CV"  # HTML CV

        # Envoie la requête de génération avec analyse + profil complets
        res = client.post("/api/cv/generate",
                          json={
                              "analyseOffre": {
                                  "titre_poste": "Développeur",
                                  "entreprise": "TechCorp",
                                  "type_contrat": "CDI",
                                  "niveau": "Junior",
                                  "competences_requises": ["React"],
                                  "competences_souhaitees": [],
                              },
                              "profil": {
                                  "nom": "Berrada", "prenom": "Rayane",
                                  "email": "rayane@test.com", "telephone": "0612345678",
                                  "ville": "Paris", "linkedin": "", "github": "",
                                  "portfolio": "", "resume": "",
                                  "experiences": [], "formations": [],
                                  "competences": [], "projets": [], "langues": []
                              }
                          },
                          headers=headers_auth())

        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "CV généré avec succès"
        assert "CV" in data["html_cv"]  # Le HTML du CV est présent

    def test_generation_sans_analyse(self, mock_db):
        """La génération sans analyse d'offre retourne une erreur 400."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)

        res = client.post("/api/cv/generate",
                          json={},  # Pas d'analyseOffre = invalide
                          headers=headers_auth())
        assert res.status_code == 400
        assert "requis" in res.json()["detail"].lower()

    def test_generation_sans_auth(self):
        """La génération sans token d'authentification retourne 403."""
        res = client.post("/api/cv/generate",
                          json={"analyseOffre": {"titre_poste": "Dev"}})
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# HISTORIQUE — GET /api/cv/history
# Teste la récupération de la liste des CV générés par l'utilisateur
# ══════════════════════════════════════════════════════════════════════════════

class TestHistory:
    """Tests pour la route d'historique des CV."""

    def test_historique_vide(self, mock_db):
        """Un utilisateur sans CV a un historique vide (liste [])."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)  # get_user_id -> ID=1
        cur.fetchall.return_value = []  # Pas de CV en BDD

        res = client.get("/api/cv/history", headers=headers_auth())

        assert res.status_code == 200
        assert res.json() == []  # Liste vide

    def test_historique_avec_cv(self, mock_db):
        """L'historique retourne les CV de l'utilisateur avec leurs métadonnées."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)  # get_user_id
        # Simule 2 CV dans la BDD : (id, date, format, statut, fichier, contenu_json)
        cur.fetchall.return_value = [
            (10, datetime(2025, 5, 1), "HTML", "actif", "cv.html", '{"nom":"test"}'),
            (11, datetime(2025, 5, 2), "HTML", "actif", "cv2.html", '{"nom":"test2"}'),
        ]

        res = client.get("/api/cv/history", headers=headers_auth())

        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2  # 2 CV retournés
        assert data[0]["id_cv"] == 10  # Premier CV a l'ID 10
        assert data[1]["id_cv"] == 11  # Deuxième CV a l'ID 11

    def test_historique_sans_auth(self):
        """L'historique sans token retourne 403."""
        res = client.get("/api/cv/history")  # Pas de header Authorization
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# PARSE CV — POST /api/cv/parse
# Teste l'extraction des données depuis un CV PDF uploadé
# ══════════════════════════════════════════════════════════════════════════════

class TestParseCV:
    """Tests pour la route de parsing de CV PDF."""

    def test_parse_fichier_non_pdf(self, mock_db):
        """Un fichier non-PDF est refusé (code 400)."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)

        # Envoie un fichier texte au lieu d'un PDF
        res = client.post("/api/cv/parse",
                          files={"file": ("cv.txt", b"contenu texte", "text/plain")},
                          headers=headers_auth())

        assert res.status_code == 400
        assert "PDF" in res.json()["detail"]  # Message d'erreur mentionne PDF

    def test_parse_sans_auth(self):
        """Le parsing sans token retourne 403."""
        res = client.post("/api/cv/parse",
                          files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")})
        assert res.status_code == 403

    @patch("routes.cv.cv_pipeline")
    def test_parse_reussi(self, mock_pipeline, mock_db):
        """Le parsing d'un PDF valide extrait et sauvegarde le profil."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)  # get_user_id

        # Simule le profil extrait par l'IA
        mock_profil = MagicMock()
        mock_profil.ville = "Paris"
        mock_profil.linkedin = ""
        mock_profil.github = ""
        mock_profil.portfolio = ""
        mock_profil.resume = ""
        mock_profil.experiences = []
        mock_profil.formations = []
        mock_profil.competences = []
        mock_profil.projets = []
        mock_profil.langues = []
        mock_profil.model_dump.return_value = {
            "prenom": "Rayane", "nom": "Berrada",
            "email": "rayane@test.com", "telephone": "0612345678",
        }
        mock_pipeline.lire_pdf.return_value = "Texte du CV extrait"  # Extraction du texte
        mock_pipeline.analyser_cv.return_value = mock_profil  # Analyse IA du texte

        # Envoie un faux fichier PDF avec le bon MIME type
        res = client.post("/api/cv/parse",
                          files={"file": ("cv.pdf", b"%PDF-1.4 content", "application/pdf")},
                          headers=headers_auth())

        assert res.status_code == 200
        assert res.json()["prenom"] == "Rayane"  # Le prénom est bien extrait

    @patch("routes.cv.cv_pipeline")
    def test_parse_pdf_illisible(self, mock_pipeline, mock_db):
        """Un PDF dont on ne peut pas extraire le texte retourne une erreur."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)
        mock_pipeline.lire_pdf.return_value = ""  # Texte vide = PDF illisible

        res = client.post("/api/cv/parse",
                          files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
                          headers=headers_auth())

        assert res.status_code == 400
        assert "Impossible de lire" in res.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# PROFIL — GET /api/cv/profil
# Teste la récupération du profil complet depuis les tables SQL
# ══════════════════════════════════════════════════════════════════════════════

class TestGetProfil:
    """Tests pour la route de récupération du profil."""

    def test_profil_complet(self, mock_db):
        """Le profil est reconstruit depuis les tables SQL (user + exp + form + etc.)."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,)
        # Simule les réponses SQL dans l'ordre :
        cur.fetchone.side_effect = [
            (1,),  # 1. get_user_id
            ("Berrada", "Rayane", "rayane@test.com", "0612345678",
             "Paris", "linkedin.com/rayane", "", "", "Développeur"),  # 2. Infos utilisateur
        ]
        # Simule les listes vides pour expériences, formations, compétences, projets, langues
        cur.fetchall.side_effect = [[], [], [], [], []]

        res = client.get("/api/cv/profil", headers=headers_auth())

        assert res.status_code == 200
        data = res.json()
        assert data["nom"] == "Berrada"
        assert data["prenom"] == "Rayane"
        assert data["email"] == "rayane@test.com"

    def test_profil_sans_auth(self):
        """Le profil sans token retourne 403."""
        res = client.get("/api/cv/profil")  # Pas de header Authorization
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# TOKEN EXPIRÉ / INVALIDE
# Teste les cas où le JWT est expiré ou malformé
# ══════════════════════════════════════════════════════════════════════════════

class TestTokenInvalide:
    """Tests pour les cas de token expiré ou invalide."""

    def test_token_expire(self, mock_db):
        """Un token expiré retourne 401 (non authentifié)."""
        now = datetime.utcnow()
        # Crée un token expiré depuis 30 minutes
        expired_token = jwt.encode({
            "sub": "rayane@test.com", "name": "rayane@test.com",
            "jti": "test-jti",
            "iat": int((now - timedelta(hours=1)).timestamp()),  # Émis il y a 1h
            "exp": now - timedelta(minutes=30),  # Expiré depuis 30 min
            "iss": JWT_ISSUER, "aud": JWT_AUDIENCE, "nbf": now - timedelta(hours=1)
        }, JWT_KEY, algorithm=JWT_ALGORITHM)

        res = client.get("/api/cv/history",
                         headers=headers_auth(expired_token))  # Utilise le token expiré
        assert res.status_code == 401  # Non authentifié

    def test_token_invalide(self, mock_db):
        """Un token complètement invalide retourne 401 ou 403."""
        res = client.get("/api/cv/history",
                         headers=headers_auth("token-completement-invalide.xyz.abc"))  # Token malformé
        assert res.status_code in (401, 403)  # L'un ou l'autre est acceptable