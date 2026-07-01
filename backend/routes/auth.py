# Importe les composants FastAPI pour les routes, erreurs HTTP, requêtes/réponses, et dépendances
from fastapi import APIRouter, HTTPException, Response, Request, Depends
# Importe le schéma de sécurité Bearer pour extraire les tokens JWT des headers
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# Importe le contexte de hachage bcrypt pour hasher/vérifier les mots de passe
from passlib.context import CryptContext
# Importe la fonction de connexion à la base de données
from database import get_db
# Importe les modèles Pydantic pour la validation des données d'inscription/connexion
from models import RegisterData, LoginData
# Importe BaseModel pour créer un modèle Pydantic inline (UpdateProfilData)
from pydantic import BaseModel
# Importe Optional pour les champs qui peuvent être None
from typing import Optional
# Importe jwt pour encoder/décoder les tokens JWT
import jwt
# Importe re pour les expressions régulières (validation email, mot de passe)
import re
# Importe datetime et timedelta pour gérer les dates et durées de tokens
from datetime import datetime, timedelta
# Importe ZoneInfo pour les fuseaux horaires (Europe/Paris)
from zoneinfo import ZoneInfo
# Importe os pour accéder aux variables d'environnement
import os
# Importe secrets pour générer des tokens aléatoires sécurisés
import secrets
# Importe hashlib pour hasher les refresh tokens avant stockage en BDD
import hashlib

# ── Fuseau horaire français pour toutes les opérations sur les dates ──────────
TZ_FR = ZoneInfo("Europe/Paris")

# ── Crée le routeur pour toutes les routes d'authentification ────────────────
router = APIRouter()
# Configure bcrypt comme algorithme de hachage des mots de passe
pwd = CryptContext(schemes=["bcrypt"])

# ── Configuration JWT (lazy — lue à chaque utilisation pour supporter les tests) ─────────────
# Les variables sont lues via des fonctions pour éviter le crash au moment de l'import
# quand les tests patch os.environ APRÈS l'import du module.

def _get_jwt_key():
    """Retourne la clé JWT depuis les variables d'environnement."""
    key = os.getenv("JWT_KEY")
    if not key:
        raise RuntimeError("JWT_KEY non définie. Vérifiez votre fichier .env")
    return key

def _get_jwt_algorithm():
    return os.getenv("JWT_ALGORITHM", "HS256")

def _get_jwt_issuer():
    return os.getenv("JWT_ISSUER", "backend")

def _get_jwt_audience():
    return os.getenv("JWT_AUDIENCE", "pfe_frontend")

def _get_jwt_duration():
    return int(os.getenv("JWT_DURATION_IN_MINUTES", "1"))

def _get_jwt_refresh_duration():
    return int(os.getenv("JWT_REFRESH_TOKEN_DURATION_IN_MINUTES", "3"))

# ── Schéma d'authentification Bearer (extrait le token du header Authorization) ──
# >>> HTTPBearer() = classe FastAPI qui sait lire automatiquement le header
# "Authorization: Bearer <token>" et en extraire le token brut.
bearer_scheme = HTTPBearer()

# ── Dépendance FastAPI : extrait et valide l'utilisateur depuis le JWT ───────
# Utilisée comme Depends() dans les routes protégées
# >>> Depends(bearer_scheme) = injecte automatiquement le résultat de
# HTTPBearer() en paramètre. C'est le système d'injection de dépendances
# de FastAPI : cette fonction s'exécute AVANT le corps de la route
# protégée, et si elle lève une exception, la route ne s'exécute jamais.
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        # Décode le JWT en vérifiant la signature, l'émetteur et l'audience
        # >>> jwt.decode() vérifie 3 choses en même temps : la SIGNATURE
        # (le token a bien été signé avec JWT_KEY), l'EXPIRATION (exp
        # dans le futur), et issuer/audience (iss/aud corrects).
        # Aucune requête BDD n'est nécessaire — le JWT est auto-porteur
        # et vérifiable mathématiquement.
        return jwt.decode(
            credentials.credentials, _get_jwt_key(),
            algorithms=[_get_jwt_algorithm()], issuer=_get_jwt_issuer(), audience=_get_jwt_audience()
        )
    except jwt.ExpiredSignatureError:
        # Token expiré → 401
        raise HTTPException(status_code=401, detail="Access token expiré")
    except jwt.InvalidTokenError:
        # Token invalide (signature incorrecte, mauvaise audience, etc.) → 401
        raise HTTPException(status_code=401, detail="Access token invalide")

# ── Validation du mot de passe selon les critères de sécurité ────────────────
# >>> re.search(motif, texte) = cherche le motif n'importe où dans le texte,
# retourne un objet Match si trouvé, None sinon. [A-Z] = une majuscule,
# \d = un chiffre, etc. — chaque ligne vérifie un critère indépendant.
def valider_mot_de_passe(mdp: str):
    # Collecte tous les critères non respectés dans une liste
    erreurs = []
    # Minimum 12 caractères
    if len(mdp) < 12: erreurs.append("12 caractères minimum")
    # Maximum 25 caractères
    if len(mdp) > 25: erreurs.append("25 caractères maximum")
    # Au moins une majuscule
    if not re.search(r'[A-Z]', mdp): erreurs.append("une majuscule")
    # Au moins une minuscule
    if not re.search(r'[a-z]', mdp): erreurs.append("une minuscule")
    # Au moins un chiffre
    if not re.search(r'\d', mdp): erreurs.append("un chiffre")
    # Au moins un caractère spécial
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', mdp): erreurs.append("un caractère spécial")
    # Si des critères manquent, renvoie une erreur 422 avec la liste
    if erreurs:
        raise HTTPException(status_code=422,
                            detail="Mot de passe invalide — Critères requis : " + ", ".join(erreurs))

# ── Validation complète de toutes les données d'inscription ──────────────────
def valider_inscription(data: RegisterData):
    # Fonction helper : lève une erreur si la condition est vraie
    def check(condition, msg):
        if condition: raise HTTPException(status_code=422, detail=msg)

    # Valide le nom : non vide, pas de chiffres, 2-50 caractères
    check(not data.nom.strip(), "Le nom est obligatoire")
    check(bool(re.search(r'\d', data.nom)), "Le nom ne doit pas contenir de chiffres")
    check(not 2 <= len(data.nom.strip()) <= 50, "Le nom doit contenir entre 2 et 50 caractères")
    # Valide le prénom : mêmes règles que le nom
    check(not data.prenom.strip(), "Le prénom est obligatoire")
    check(bool(re.search(r'\d', data.prenom)), "Le prénom ne doit pas contenir de chiffres")
    check(not 2 <= len(data.prenom.strip()) <= 50, "Le prénom doit contenir entre 2 et 50 caractères")
    # Valide l'email : non vide et format correct
    check(not data.email.strip(), "L'email est obligatoire")
    check(not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', data.email.strip()), "Le format de l'email est invalide")
    # Valide le numéro : non vide, chiffres uniquement, exactement 10 chiffres
    check(not data.numero.strip(), "Le numéro de téléphone est obligatoire")
    check(not re.fullmatch(r'\d+', data.numero.strip()), "Le numéro doit contenir uniquement des chiffres")
    check(len(data.numero.strip()) != 10, "Le numéro doit contenir exactement 10 chiffres")
    # Valide le mot de passe : non vide et respecte les critères de sécurité
    check(not data.motDePasse, "Le mot de passe est obligatoire")
    valider_mot_de_passe(data.motDePasse)

# ── Helpers pour la génération de tokens ─────────────────────────────────────

# Génère un access token JWT court (retourne le token + sa date d'expiration en ms)
# >>> Stratégie access/refresh token : l'access token (court, ici 60 min en
# pratique) est vérifié par signature sans aucune requête BDD — rapide
# mais non révocable avant expiration. Le refresh token (plus long) est
# lui vérifié EN BDD (voir generate_tokens) — plus lent mais révocable
# à tout moment (logout).
def generate_access_token(email: str) -> tuple[str, int]:
    """Retourne (access_token_jwt, expires_at_ms)."""
    # Date et heure actuelles dans le fuseau français
    now = datetime.now(TZ_FR)
    # Calcule la date d'expiration (now + durée configurée)
    exp = now + timedelta(minutes=_get_jwt_duration())
    # Encode le JWT avec toutes les claims standard
    # >>> jwt.encode(payload, clé_secrète, algorithm) = signe cryptographiquement
    # ce dict avec JWT_KEY. Le résultat est une chaîne signée que jwt.decode()
    # pourra vérifier plus tard avec la même clé (HMAC symétrique HS256).
    token = jwt.encode({
        "sub": email, "name": email,
        # Identifiant unique du token (anti-replay)
        "jti": secrets.token_hex(16),
        # Date d'émission (issued at)
        "iat": int(now.timestamp()),
        # Date d'expiration
        "exp": exp,
        # Émetteur et audience
        "iss": _get_jwt_issuer(), "aud": _get_jwt_audience(), "nbf": now
    }, _get_jwt_key(), algorithm=_get_jwt_algorithm())
    # Retourne le token et son expiration en millisecondes
    return token, int(exp.timestamp() * 1000) # En millisecondes parceque JS/REACT extrait le temps en ms et non pas en secondes comme python

# Génère access token + refresh token en une seule fois
def generate_tokens(email: str) -> dict:
    """Génère access token + refresh token. Retourne tous les champs nécessaires."""
    # Génère d'abord l'access token
    access_token, access_exp_ms = generate_access_token(email)

    # Date actuelle pour le refresh token
    now = datetime.now(TZ_FR)
    # Expiration du refresh token (plus longue que l'access)
    refresh_exp = now + timedelta(minutes=_get_jwt_refresh_duration())
    # Génère un refresh token aléatoire sécurisé (64 bytes → ~86 chars URL-safe)
    # >>> secrets.token_urlsafe() = génère une chaîne aléatoire cryptographiquement
    # sûre, contrairement à random — indispensable pour un token de sécurité.
    raw_refresh = secrets.token_urlsafe(64)

    # Retourne un dictionnaire avec toutes les informations nécessaires
    return {
        "access_token": access_token,
        "access_token_expires_ms": access_exp_ms,
        # Token brut (envoyé au client dans un cookie)
        "refresh_token_raw": raw_refresh,
        # Hash SHA-256 du token (stocké en BDD, jamais le token en clair)
        # >>> Même principe que bcrypt pour les mots de passe : si la BDD est
        # compromise, l'attaquant n'a que des hashs, pas les vrais tokens
        # utilisables. Le token BRUT n'existe que dans le cookie du client.
        "refresh_token_hash": hashlib.sha256(raw_refresh.encode()).hexdigest(),
        # Date d'expiration pour la BDD
        "refresh_token_expiry": refresh_exp,
        # Expiration en millisecondes pour le frontend
        "refresh_token_expires_ms": int(refresh_exp.timestamp() * 1000),
    }

# Hashe un token avec SHA-256 (pour la comparaison avec la BDD)
def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

# Normalise un datetime pour qu'il soit timezone-aware (UTC par défaut)
def normalize_dt(dt: datetime) -> datetime:
    """Rend un datetime timezone-aware (UTC) s'il ne l'est pas déjà."""
    return dt if dt.tzinfo else dt.replace(tzinfo=ZoneInfo("UTC"))

# ══════════════════════════════════════════════════════════════════════════════
# ── ROUTES ────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

# ── POST /register : inscription d'un nouvel utilisateur ─────────────────────
# >>> Aucune annotation de type sur la route elle-même, mais FastAPI lit le
# type "data: RegisterData" pour valider AUTOMATIQUEMENT le body JSON
# avant même d'exécuter cette fonction.
@router.post("/register")
def register(data: RegisterData):
    # Valide toutes les données d'inscription (nom, email, mot de passe, etc.)
    valider_inscription(data)

    # Ouvre une connexion à la base de données
    conn = get_db()
    cur = conn.cursor()

    # Vérifie que l'email n'est pas déjà utilisé
    cur.execute("SELECT id FROM users WHERE email = %s", (data.email,))
    if cur.fetchone():
        # Email déjà pris → erreur 400
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    # Insère le nouvel utilisateur avec le mot de passe hashé (bcrypt)
    # >>> pwd.hash() = bcrypt génère un SEL ALÉATOIRE différent à chaque appel,
    # donc deux utilisateurs avec le même mot de passe auront des hashs
    # différents en BDD — protège contre les attaques par dictionnaire/rainbow table.
    cur.execute(
        "INSERT INTO users (nom, prenom, email, numero, mot_de_passe) VALUES (%s,%s,%s,%s,%s) RETURNING id",
        (data.nom, data.prenom, data.email, data.numero, pwd.hash(data.motDePasse))
    )
    # Récupère l'ID auto-généré du nouvel utilisateur
    user_id = cur.fetchone()[0]
    # Valide la transaction
    conn.commit()
    cur.close(); conn.close()

    # Retourne un message de succès avec les infos de base
    return {"message": "Utilisateur créé avec succès", "id": user_id, "email": data.email}

# ── POST /login : connexion d'un utilisateur existant ────────────────────────
# >>> Protection brute-force PAR IP (pas par compte) : empêche qu'un
# attaquant bloque délibérément le compte d'une victime en multipliant
# les tentatives échouées sur son email.
@router.post("/login")
def login(data: LoginData, response: Response, request: Request):
    # Récupère l'IP du client pour le système de blocage anti-bruteforce
    ip = request.client.host
    # Heure actuelle en UTC pour les comparaisons de dates
    now_utc = datetime.utcnow()

    # Ouvre une connexion à la BDD
    conn = get_db()
    cur = conn.cursor()

    try:
        # 1. Récupère la dernière tentative de connexion pour cette IP
        cur.execute("""
            SELECT id, attemptcount, lockeduntil FROM loginattempts
            WHERE ip_adresse = %s ORDER BY lastattemptat DESC LIMIT 1
        """, (ip,))
        last = cur.fetchone()

        # 2. Vérifie si l'IP est actuellement bloquée
        if last:
            _, _, locked_until = last
            # Si le blocage est encore actif (locked_until > now)
            if locked_until and locked_until > now_utc:
                # Calcule les secondes restantes
                secs = int((locked_until - now_utc).total_seconds())
                cur.close(); conn.close()
                raise HTTPException(status_code=403,
                                    detail=f"Trop de tentatives. Réessayez dans {secs} secondes.")

        # 3. Vérifie l'email et le mot de passe en BDD
        cur.execute("SELECT id, mot_de_passe, nom, prenom FROM users WHERE email = %s", (data.email,))
        user = cur.fetchone()

        # Si l'utilisateur n'existe pas OU le mot de passe est incorrect
        # >>> pwd.verify(brut, hash) = re-hash le mot de passe reçu avec le
        # même sel que celui stocké, puis compare les deux hashs.
        # >>> Même code 401 pour "email inconnu" ET "mauvais mot de passe" :
        # décision de sécurité volontaire pour empêcher un attaquant de
        # deviner quels emails sont enregistrés (énumération de comptes).
        if not user or not pwd.verify(data.motDePasse, user[1]):
            # Détermine si c'est une nouvelle session (compteur à 1)
            nouvelle_session = last is None or last[2] is not None
            # Incrémente le compteur ou repart à 1
            new_count = 1 if nouvelle_session else last[1] + 1

            # Après 3 échecs → blocage de l'IP pendant 1 minute
            if new_count >= 3:
                locked_until = now_utc + timedelta(minutes=1)
                msg, code = "Trop d'échecs. Votre IP est bloquée pendant 1 minute.", 403
            else:
                # Moins de 3 échecs → indique le nombre de tentatives restantes
                locked_until = None
                reste = 3 - new_count
                suffixe = "tentative" if reste == 1 else "tentatives"
                msg, code = f"Email ou mot de passe incorrect. Il vous reste {reste} {suffixe}.", 401

            if nouvelle_session:
                # Nouvelle session d'échec → insère une nouvelle ligne
                cur.execute("""
                    INSERT INTO loginattempts (ip_adresse, attemptcount, lastattemptat, lockeduntil)
                    VALUES (%s, %s, %s, %s)
                """, (ip, new_count, now_utc, locked_until))
            else:
                # Session existante → met à jour le compteur et le lock
                cur.execute("""
                    UPDATE loginattempts
                    SET attemptcount=%s, lastattemptat=%s, lockeduntil=%s
                    WHERE id=%s
                """, (new_count, now_utc, locked_until, last[0]))

            # Valide et retourne l'erreur
            conn.commit(); cur.close(); conn.close()
            raise HTTPException(status_code=code, detail=msg)

        # 4. Connexion réussie → supprime la session active pour repartir
        # à 3 tentatives lors de la prochaine erreur.
        # Les lignes avec lockeduntil NOT NULL (historique) sont conservées.
        cur.execute(
            "DELETE FROM loginattempts WHERE ip_adresse = %s AND lockeduntil IS NULL", (ip,)
        )
        conn.commit()

        # Extrait les données utilisateur
        user_id, _, nom, prenom = user

    except HTTPException:
        # Relève les erreurs HTTP telles quelles (déjà gérées)
        raise
    except Exception as e:
        # Erreur inattendue → rollback et erreur 500
        conn.rollback(); cur.close(); conn.close()
        print(f"ERREUR SQL LOGIN: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne serveur: {str(e)}")

    # Génère les tokens (access + refresh) pour l'utilisateur connecté
    tokens = generate_tokens(data.email)

    # Stocke le hash du refresh token en BDD (jamais le token brut)
    cur.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (%s,%s,%s,%s)",
        (user_id, tokens["refresh_token_hash"], tokens["refresh_token_expiry"], datetime.now(TZ_FR))
    )
    conn.commit()
    cur.close(); conn.close()

    # Définit le refresh token dans un cookie HTTP-only sécurisé
    # >>> httponly=True : JavaScript ne peut JAMAIS lire ce cookie (protection XSS)
    # secure=True : transmis uniquement en HTTPS
    # samesite="strict" : jamais envoyé depuis un site tiers (protection CSRF)
    response.set_cookie(
        key="refreshToken", value=tokens["refresh_token_raw"],
        httponly=True, secure=True, samesite="strict",
        max_age=_get_jwt_refresh_duration() * 60, path="/"
    )

    # Retourne l'access token + les expirations + les infos utilisateur
    return {
        "accessToken": tokens["access_token"],
        "accessExpiresAt": tokens["access_token_expires_ms"],
        "refreshExpiresAt": tokens["refresh_token_expires_ms"],
        "user": {"id": user_id, "email": data.email, "nom": nom, "prenom": prenom}
    }

# ── GET /restore-session : restaure la session après un refresh de page (F5) ──
# >>> Indispensable car l'access token vit en mémoire React (useState) et
# disparaît à chaque F5. Le cookie refreshToken, lui, survit (géré par
# le navigateur) — cette route régénère un nouvel access token à partir
# de ce cookie, sans redemander le mot de passe.
@router.get("/restore-session")
def restore_session(request: Request):
    """
    Appelée au refresh de page (F5).
    Valide le cookie refresh token en BDD (révocation + expiration),
    retourne un nouvel access token SANS toucher au refresh token.
    """
    # Récupère le refresh token depuis le cookie
    raw = request.cookies.get("refreshToken")
    if not raw:
        raise HTTPException(status_code=401, detail="Pas de refresh token")

    # Vérifie le token en base de données
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT rt.expires_at, rt.revoked_at, u.email
        FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
        WHERE rt.token_hash = %s ORDER BY rt.created_at DESC LIMIT 1
    """, (hash_token(raw),))
    result = cur.fetchone()
    cur.close(); conn.close()

    # Token introuvable en BDD
    if not result:
        raise HTTPException(status_code=401, detail="Refresh token introuvable")

    # Extrait les informations du token
    expires_at, revoked_at, email = result

    # Vérifie si le token a été révoqué (déconnexion)
    if revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token révoqué")
    # Vérifie si le token a expiré
    if normalize_dt(expires_at) < datetime.now(TZ_FR):
        raise HTTPException(status_code=401, detail="Refresh token expiré")

    # Génère un nouvel access token (sans renouveler le refresh)
    access_token, access_exp_ms = generate_access_token(email)

    # Retourne les nouveaux tokens
    return {
        "accessToken": access_token,
        "accessExpiresAt": access_exp_ms,
        "refreshExpiresAt": int(normalize_dt(expires_at).timestamp() * 1000),
    }

# ── GET /check-refresh : vérifie la validité du refresh token ────────────────
@router.get("/check-refresh")
def check_refresh(request: Request):
    """
    Vérifie le cookie refresh token en BDD (révocation + expiration).
    Retourne la vraie date d'expiration depuis la BDD.
    """
    # Récupère le refresh token depuis le cookie
    raw = request.cookies.get("refreshToken")
    if not raw:
        raise HTTPException(status_code=401, detail="Pas de refresh token")

    # Vérifie le token en base de données
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT expires_at, revoked_at FROM refresh_tokens WHERE token_hash = %s ORDER BY created_at DESC LIMIT 1",
        (hash_token(raw),)
    )
    result = cur.fetchone()
    cur.close(); conn.close()

    # Token introuvable en BDD
    if not result:
        raise HTTPException(status_code=401, detail="Refresh token introuvable")

    # Extrait les dates
    expires_at, revoked_at = result

    # Vérifie la révocation
    if revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token révoqué")

    # Normalise et vérifie l'expiration
    expires_at = normalize_dt(expires_at)
    if expires_at < datetime.now(TZ_FR):
        raise HTTPException(status_code=401, detail="Refresh token expiré")

    # Retourne le statut valide et la timestamp d'expiration
    return {"valid": True, "expires_at": expires_at.isoformat()}

# ── POST /logout : déconnexion de l'utilisateur ──────────────────────────────
@router.post("/logout")
def logout(request: Request, response: Response):
    # Récupère le refresh token depuis le cookie
    raw = request.cookies.get("refreshToken")
    if raw:
        # Révoque le token en BDD en mettant la date de révocation
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE refresh_tokens SET revoked_at = %s WHERE token_hash = %s",
            (datetime.now(TZ_FR), hash_token(raw))
        )
        conn.commit()
        cur.close(); conn.close()

    # Supprime le cookie du navigateur
    response.delete_cookie(key="refreshToken", path="/")
    return {"message": "Déconnexion réussie"}

# ── GET /me : retourne les informations de l'utilisateur connecté ────────────
@router.get("/me")
def me(payload: dict = Depends(get_current_user)):
    # Ouvre une connexion à la BDD
    conn = get_db()
    cur = conn.cursor()
    # Recherche l'utilisateur par email (stocké dans "sub" du JWT)
    cur.execute("SELECT id, nom, prenom, email, numero FROM users WHERE email = %s", (payload["sub"],))
    user = cur.fetchone()
    cur.close(); conn.close()

    # Utilisateur introuvable (email du JWT n'existe plus en BDD)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Retourne les infos de l'utilisateur
    return {"id": user[0], "nom": user[1], "prenom": user[2], "email": user[3], "numero": user[4]}

# ── Modèle Pydantic pour la mise à jour du profil ────────────────────────────
class UpdateProfilData(BaseModel):
    # Tous les champs sont optionnels (on ne met à jour que ce qui est fourni)
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None
    numero: Optional[str] = None

# ── PUT /update-profile : met à jour les infos de base de l'utilisateur ──────
@router.put("/update-profile")
def update_profile(data: UpdateProfilData, payload: dict = Depends(get_current_user)):
    """Met à jour les informations de base de l'utilisateur (nom, prenom, email, numero)."""
    conn = get_db()
    cur = conn.cursor()

    # Récupère l'utilisateur actuel depuis la BDD
    cur.execute("SELECT id, nom, prenom, email, numero FROM users WHERE email = %s", (payload["sub"],))
    user = cur.fetchone()

    # Utilisateur introuvable
    if not user:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    user_id = user[0]

    # Vérifie si le nouvel email n'est pas déjà utilisé par un autre utilisateur
    if data.email and data.email != payload["sub"]:
        cur.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data.email, user_id))
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    # Construit la requête UPDATE dynamiquement (seulement les champs fournis)
    # >>> Pattern courant : on ne sait pas à l'avance quels champs seront
    # fournis (tous Optional), donc on construit la requête SQL
    # dynamiquement en n'ajoutant que les colonnes réellement modifiées.
    updates = []
    values = []

    # Ajoute chaque champ non-None à la mise à jour
    if data.nom is not None:
        updates.append("nom = %s")
        values.append(data.nom)
    if data.prenom is not None:
        updates.append("prenom = %s")
        values.append(data.prenom)
    if data.email is not None:
        updates.append("email = %s")
        values.append(data.email)
    if data.numero is not None:
        updates.append("numero = %s")
        values.append(data.numero)

    # Si aucun champ n'a été fourni, rien à faire
    if not updates:
        cur.close()
        conn.close()
        return {"message": "Aucune modification à effectuer"}

    # Ajoute l'ID utilisateur pour la clause WHERE
    values.append(user_id)
    # Construit et exécute la requête UPDATE
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
    cur.execute(query, values)
    conn.commit()
    cur.close()
    conn.close()

    # Retourne un message de succès
    return {"message": "Profil mis à jour avec succès"}