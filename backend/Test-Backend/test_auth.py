"""
Tests unitaires pour les routes d'authentification (routes/auth.py).
Utilise pytest + FastAPI TestClient avec mock de la base de données.
Couvre : inscription, connexion, déconnexion, restauration de session,
         validation du mot de passe.
"""
# Import de pytest pour les fixtures et assertions
import pytest
# Import des outils de mock : patch pour remplacer des fonctions, MagicMock pour simuler des objets
from unittest.mock import patch, MagicMock
# Import du client de test FastAPI pour envoyer des requêtes HTTP simulées
from fastapi.testclient import TestClient
# Import de l'application FastAPI principale
from main import app
# Import de la bibliothèque JWT pour créer/vérifier des tokens dans les tests
import jwt
# Import du module os pour manipuler les variables d'environnement
import os

# ── Client de test FastAPI : simule un client HTTP pour envoyer des requêtes à l'app ──
client = TestClient(app)

# ── Fixtures : objets partagés entre les tests ────────────────────────────

@pytest.fixture(autouse=True)
def mock_db():
    """Mock la connexion DB pour chaque test.
    Remplace get_db() par un mock qui retourne une connexion
    et un curseur simulés. Chaque test a sa propre instance."""
    with patch("routes.auth.get_db") as mock:
        conn = MagicMock() # Simule la connexion à la BDD
        cur = MagicMock()  # Simule le curseur pour exécuter des requêtes SQL
        conn.cursor.return_value = cur # conn.cursor() retourne le curseur mocké
        mock.return_value = conn # get_db() retourne la connexion mockée
        yield conn, cur # Fournit (connexion, curseur) au test


@pytest.fixture
def mock_env():
    """S'assure que les variables JWT sont définies pour les tests.
    Utilise patch.dict pour injecter temporairement des variables
    d'environnement dans os.environ."""
    with patch.dict(os.environ, {
        "JWT_KEY": "test-secret-key-12345",           # Clé secrète de test
        "JWT_ALGORITHM": "HS256",                      # Algorithme HMAC-SHA256
        "JWT_ISSUER": "backend",                       # Émetteur attendu
        "JWT_AUDIENCE": "pfe_frontend",                 # Audience attendue
        "JWT_DURATION_IN_MINUTES": "1",                # Token valide 1 minute
        "JWT_REFRESH_TOKEN_DURATION_IN_MINUTES": "3",  # Refresh valide 3 minutes
    }):
        yield # Exécute le test avec ces variables


# ══════════════════════════════════════════════════════════════════════════════
#  INSCRIPTION — POST /api/auth/register
#  Teste la création de compte utilisateur avec validation des champs
# ══════════════════════════════════════════════════════════════════════════════

class TestRegister:
    """Tests pour la route d'inscription."""

    def test_inscription_reussie(self, mock_db, mock_env):
        """Un utilisateur valide est créé avec succès (code 200)."""
        conn, cur = mock_db
        # Simule que l'email n'existe pas encore (pas de doublon)
        cur.fetchone.return_value = None
        # Premier fetchone : SELECT email (None = pas trouvé)
        # Deuxième fetchone : INSERT RETURNING (1,) = ID du nouvel utilisateur
        cur.fetchone.side_effect = [None, (1,)]

        # Envoie une requête POST avec des données valides
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "rayane@test.com", "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345678"
        })

        # Vérifie le code HTTP et le contenu de la réponse
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "Utilisateur créé avec succès"
        assert data["email"] == "rayane@test.com"

    def test_nom_obligatoire(self, mock_db, mock_env):
        """Le nom est obligatoire : un nom vide retourne 422."""
        res = client.post("/api/auth/register", json={
            "nom": "", "prenom": "Rayane",
            "email": "r@test.com", "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345678"
        })
        assert res.status_code == 422 # Erreur de validation
        assert "nom est obligatoire" in res.json()["detail"]

    def test_nom_avec_chiffres(self, mock_db, mock_env):
        """Le nom ne doit pas contenir de chiffres."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada123", "prenom": "Rayane", # Nom invalide : contient "123"
            "email": "r@test.com", "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "chiffres" in res.json()["detail"]

    def test_prenom_obligatoire(self, mock_db, mock_env):
        """Le prénom est obligatoire : un prénom vide retourne 422."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "", # Prénom vide
            "email": "r@test.com", "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "prénom est obligatoire" in res.json()["detail"]

    def test_email_invalide(self, mock_db, mock_env):
        """Le format de l'email doit être valide (regex RFC)."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "pas-un-email", # Email sans @ ni domaine
            "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "email" in res.json()["detail"].lower()

    def test_numero_doit_avoir_10_chiffres(self, mock_db, mock_env):
        """Le numéro de téléphone doit contenir exactement 10 chiffres."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "r@test.com", "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345" # Seulement 7 chiffres
        })
        assert res.status_code == 422
        assert "10 chiffres" in res.json()["detail"]

    def test_mot_de_passe_trop_court(self, mock_db, mock_env):
        """Le mot de passe doit faire au moins 12 caractères."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "r@test.com", "motDePasse": "Ab1!", # Seulement 4 caractères
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "12 caractères" in res.json()["detail"]

    def test_mot_de_passe_sans_majuscule(self, mock_db, mock_env):
        """Le mot de passe doit contenir une majuscule."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "r@test.com",
            "motDePasse": "monsupermotdepasse!2025", # Pas de majuscule
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "majuscule" in res.json()["detail"]

    def test_mot_de_passe_sans_chiffre(self, mock_db, mock_env):
        """Le mot de passe doit contenir un chiffre."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "r@test.com",
            "motDePasse": "MonSuperMotdepasse!", # Pas de chiffre
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "chiffre" in res.json()["detail"]

    def test_mot_de_passe_sans_caractere_special(self, mock_db, mock_env):
        """Le mot de passe doit contenir un caractère spécial (!@#$...)."""
        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "r@test.com",
            "motDePasse": "MonSuperMotdepasse2025", # Pas de caractère spécial
            "numero": "0612345678"
        })
        assert res.status_code == 422
        assert "caractère spécial" in res.json()["detail"]

    def test_email_deja_utilise(self, mock_db, mock_env):
        """Un email déjà enregistré ne peut pas être réutilisé."""
        conn, cur = mock_db
        cur.fetchone.return_value = (1,) # Simule que l'email existe déjà (ID=1)

        res = client.post("/api/auth/register", json={
            "nom": "Berrada", "prenom": "Rayane",
            "email": "rayane@test.com", "motDePasse": "MonSuperMot2passe!2025",
            "numero": "0612345678"
        })
        assert res.status_code == 400 # Conflit : ressource déjà existante
        assert "déjà utilisé" in res.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
#  CONNEXION — POST /api/auth/login
#  Teste l'authentification avec email + mot de passe
# ══════════════════════════════════════════════════════════════════════════════

class TestLogin:
    """Tests pour la route de connexion."""

    def test_connexion_reussie(self, mock_db, mock_env):
        """Connexion réussie avec identifiants corrects (code 200 + JWT)."""
        conn, cur = mock_db
        # Hache le mot de passe avec bcrypt pour simuler le hash en BDD
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"])
        hashed = pwd.hash("MonSuperMot2passe!2025") # Hash bcrypt du bon mdp

        # Simule les réponses SQL dans l'ordre :
        cur.fetchone.side_effect = [
            None,                              # 1. Pas de tentative de lockout
            (1, hashed, "Berrada", "Rayane"),  # 2. Utilisateur trouvé avec bon hash
        ]

        # Envoie les identifiants corrects
        res = client.post("/api/auth/login", json={
            "email": "rayane@test.com",
            "motDePasse": "MonSuperMot2passe!2025"
        })

        # Vérifie la réponse : token + données utilisateur
        assert res.status_code == 200
        data = res.json()
        assert "accessToken" in data # Le token JWT est présent
        assert data["user"]["email"] == "rayane@test.com"
        assert data["user"]["nom"] == "Berrada"

    def test_connexion_mauvais_mot_de_passe(self, mock_db, mock_env):
        """Un mauvais mot de passe retourne une erreur 401."""
        conn, cur = mock_db

        # Hache un AUTRE mot de passe (pas celui envoyé par l'utilisateur)
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"])
        hashed = pwd.hash("AutreMotDePasse!2025") # Hash différent

        cur.fetchone.side_effect = [
            None,                              # Pas de lockout
            (1, hashed, "Berrada", "Rayane"),  # User trouvé mais hash ne correspond pas
        ]

        res = client.post("/api/auth/login", json={
            "email": "rayane@test.com",
            "motDePasse": "MauvaisMotDePasse!1" # Mot de passe incorrect
        })

        assert res.status_code == 401 # Non autorisé
        assert "incorrect" in res.json()["detail"].lower()

    def test_connexion_email_inexistant(self, mock_db, mock_env):
        """Un email non trouvé dans la BDD retourne une erreur 401."""
        conn, cur = mock_db
        cur.fetchone.side_effect = [None, None] # Pas de lock, pas d'utilisateur

        res = client.post("/api/auth/login", json={
            "email": "inconnu@test.com",
            "motDePasse": "MonSuperMot2passe!2025"
        })

        assert res.status_code == 401 # Même code que mauvais mdp (sécurité)

    def test_ip_bloquee(self, mock_db, mock_env):
        """Une IP bloquée (trop de tentatives) ne peut pas se connecter."""
        from datetime import datetime, timedelta
        conn, cur = mock_db

        # Simule un lockout actif : l'IP est bloquée jusqu'à cette date
        locked_until = datetime.utcnow() + timedelta(seconds=60)
        cur.fetchone.return_value = (1, 3, locked_until) # (id, tentatives, date_fin_lock)

        res = client.post("/api/auth/login", json={
            "email": "rayane@test.com",
            "motDePasse": "MonSuperMot2passe!2025"
        })

        assert res.status_code == 403 # Forbidden : accès refusé
        assert "tentatives" in res.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════════
#  DÉCONNEXION — POST /api/auth/logout
#  Teste la suppression du cookie et la révocation du token
# ══════════════════════════════════════════════════════════════════════════════

class TestLogout:
    """Tests pour la route de déconnexion."""

    def test_deconnexion_reussie(self, mock_db, mock_env):
        """La déconnexion supprime le cookie et révoque le token (code 200)."""
        res = client.post("/api/auth/logout")
        assert res.status_code == 200
        assert res.json()["message"] == "Déconnexion réussie"


# ══════════════════════════════════════════════════════════════════════════════
#  RESTORE SESSION — GET /api/auth/restore-session
#  Teste la restauration de session via le refresh token (cookie)
# ══════════════════════════════════════════════════════════════════════════════

class TestRestoreSession:
    """Tests pour la restauration de session."""

    def test_pas_de_cookie(self, mock_db, mock_env):
        """Sans cookie refresh token, retourne 401 (non authentifié)."""
        res = client.get("/api/auth/restore-session")
        assert res.status_code == 401
        assert "refresh token" in res.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════════
#  VALIDATION DU MOT DE PASSE (fonction isolée)
#  Teste la fonction valider_mot_de_passe() indépendamment des routes
# ══════════════════════════════════════════════════════════════════════════════

class TestValidationMotDePasse:
    """Tests pour la fonction de validation du mot de passe."""

    def test_mot_de_passe_valide(self, mock_env):
        """Un mot de passe conforme ne lève aucune exception."""
        from routes.auth import valider_mot_de_passe
        # Ne doit pas lever d'exception : 12+ chars, majuscule, chiffre, spécial
        valider_mot_de_passe("MonSuperMot2passe!2025")

    def test_mot_de_passe_trop_long(self, mock_env):
        """Un mot de passe de plus de 25 caractères est refusé."""
        from routes.auth import valider_mot_de_passe
        from fastapi import HTTPException
        # Vérifie que l'exception HTTP est bien levée
        with pytest.raises(HTTPException) as exc:
            valider_mot_de_passe("A" * 26 + "b1!") # 29 caractères = trop long
        assert "25 caractères" in str(exc.value.detail)
