from fastapi import APIRouter, HTTPException, Response, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from database import get_db
from models import RegisterData, LoginData, RefreshToken
import jwt
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import os
import secrets
import hashlib

# Heure de Paris pour les JWT
TZ_FR = ZoneInfo("Europe/Paris")

router = APIRouter()
pwd = CryptContext(schemes=["bcrypt"])

# ---- Configuration JWT (depuis .env) ----
JWT_KEY = os.getenv("JWT_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "backend")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "pfe_frontend")
JWT_DURATION_MINUTES = int(os.getenv("JWT_DURATION_IN_MINUTES", 1))
JWT_REFRESH_DURATION_MINUTES = int(os.getenv("JWT_REFRESH_TOKEN_DURATION_IN_MINUTES", 3))

bearer_scheme = HTTPBearer()


# -------------------------------------------------------------
# Dépendance : vérification du JWT
# -------------------------------------------------------------

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    Dépendance FastAPI injectée dans les routes protégées.
    Lit le header :  Authorization: Bearer <access_token>
    Vérifie la signature, l'expiration, l'issuer et l'audience.
    Retourne le payload du JWT si tout est valide.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            JWT_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Access token invalide")


# -------------------------------------------------------------
# Validations inscription
# -------------------------------------------------------------

def valider_mot_de_passe(mdp: str):
    """Vérifie que le mot de passe respecte les règles de sécurité"""
    erreurs = []
    if len(mdp) < 12:                                   erreurs.append("12 caractères minimum")
    if len(mdp) > 25:                                   erreurs.append("25 caractères maximum")
    if not re.search(r'[A-Z]', mdp):                    erreurs.append("une majuscule")
    if not re.search(r'[a-z]', mdp):                    erreurs.append("une minuscule")
    if not re.search(r'\d', mdp):                       erreurs.append("un chiffre")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', mdp):  erreurs.append("un caractère spécial")
    if erreurs:
        raise HTTPException(status_code=422, detail="Mot de passe invalide — Critères requis : " + ", ".join(erreurs))


def valider_inscription(data: RegisterData):
    """
    Valide les champs de l'inscription côté backend.
    Lève une 422 au premier champ invalide.
    """
    # Nom
    if not data.nom.strip():
        raise HTTPException(status_code=422, detail="Le nom est obligatoire")
    if re.search(r'\d', data.nom):
        raise HTTPException(status_code=422, detail="Le nom ne doit pas contenir de chiffres")
    if len(data.nom.strip()) < 2 or len(data.nom.strip()) > 50:
        raise HTTPException(status_code=422, detail="Le nom doit contenir entre 2 et 50 caractères")

    # Prénom
    if not data.prenom.strip():
        raise HTTPException(status_code=422, detail="Le prénom est obligatoire")
    if re.search(r'\d', data.prenom):
        raise HTTPException(status_code=422, detail="Le prénom ne doit pas contenir de chiffres")
    if len(data.prenom.strip()) < 2 or len(data.prenom.strip()) > 50:
        raise HTTPException(status_code=422, detail="Le prénom doit contenir entre 2 et 50 caractères")

    # Email
    if not data.email.strip():
        raise HTTPException(status_code=422, detail="L'email est obligatoire")
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, data.email.strip()):
        raise HTTPException(status_code=422, detail="Le format de l'email est invalide")

    # Téléphone
    if not data.numero.strip():
        raise HTTPException(status_code=422, detail="Le numéro de téléphone est obligatoire")
    if not re.fullmatch(r'\d+', data.numero.strip()):
        raise HTTPException(status_code=422, detail="Le numéro doit contenir uniquement des chiffres")
    if len(data.numero.strip()) != 10:
        raise HTTPException(status_code=422, detail="Le numéro doit contenir exactement 10 chiffres")

    # Mot de passe
    if not data.motDePasse:
        raise HTTPException(status_code=422, detail="Le mot de passe est obligatoire")
    valider_mot_de_passe(data.motDePasse)


# -------------------------------------------------------------
# Services JWT (access + refresh)
# -------------------------------------------------------------

def generate_access_token(username: str) -> str:
    """Génère un JWT signé (Access Token)"""
    now = datetime.now(TZ_FR)   # heure de Paris
    claims = {
        "sub": username,
        "name": username,
        "jti": secrets.token_hex(16),
        "iat": int(now.timestamp()),
        "exp": now + timedelta(minutes=JWT_DURATION_MINUTES),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "nbf": now
    }
    return jwt.encode(claims, JWT_KEY, algorithm=JWT_ALGORITHM)


def generate_refresh_token() -> tuple[str, str, datetime]:
    """Renvoie (valeur brute, hash, date expiration) pour le refresh token"""
    raw_token = secrets.token_urlsafe(64)
    hash_bytes = hashlib.sha256(raw_token.encode()).digest()
    token_hash = hash_bytes.hex()
    expiry = datetime.now(TZ_FR) + timedelta(minutes=JWT_REFRESH_DURATION_MINUTES)
    return (raw_token, token_hash, expiry)


def generate_tokens(username: str) -> dict:
    """Access + refresh token d'un coup"""
    access_token = generate_access_token(username)
    raw_refresh, hash_refresh, expiry = generate_refresh_token()
    return {
        "access_token": access_token,
        "refresh_token_raw": raw_refresh,
        "refresh_token_hash": hash_refresh,
        "refresh_token_expiry": expiry
    }


# -------------------------------------------------------------
# Routes
# -------------------------------------------------------------

# ---- Inscription ----
@router.post("/register")
def register(data: RegisterData):
    # Double validation (mêmes règles que le frontend)
    valider_inscription(data)

    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id FROM users WHERE email = %s", (data.email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    cur.execute(
        "INSERT INTO users (nom, prenom, email, numero, mot_de_passe) VALUES (%s,%s,%s,%s,%s) RETURNING id",
        (data.nom, data.prenom, data.email, data.numero, pwd.hash(data.motDePasse))
    )
    user_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return {
        "message": "Utilisateur créé avec succès",
        "id": user_id,
        "email": data.email
    }


# ---- Connexion ----
@router.post("/login")
def login(data: LoginData, response: Response, request: Request):
    ip = request.client.host

    # Pour tout ce qui touche à loginattempts on utilise datetime.utcnow()
    # (naïf UTC) parce que la base stocke les TIMESTAMP sans timezone en UTC.
    # Si on mélange avec l'heure de Paris, les comparaisons sont faussées.
    now_utc = datetime.utcnow()

    conn = get_db()
    cur = conn.cursor()

    try:
        # 1. Dernière ligne de tentatives pour cette IP
        cur.execute("""
            SELECT id, attemptcount, lockeduntil
            FROM loginattempts
            WHERE ip_adresse = %s
            ORDER BY lastattemptat DESC
            LIMIT 1
        """, (ip,))
        last_record = cur.fetchone()

        # 2. Si l'IP est bloquée, on refuse
        if last_record:
            rec_id, count, locked_until = last_record
            if locked_until and locked_until > now_utc:
                temps_restant = int((locked_until - now_utc).total_seconds())
                cur.close()
                conn.close()
                raise HTTPException(
                    status_code=403,
                    detail=f"Trop de tentatives. Votre IP est bloquée. Réessayez dans {temps_restant} secondes."
                )

        # 3. Recherche de l'utilisateur par email
        cur.execute("SELECT id, mot_de_passe, nom, prenom FROM users WHERE email = %s", (data.email,))
        user = cur.fetchone()

        # 4. Mauvais identifiants
        if not user or not pwd.verify(data.motDePasse, user[1]):

            # On détermine si c'est une nouvelle session de tentatives
            # Nouvelle session si :
            #   - aucun enregistrement (première tentative de l'IP)
            #   - le dernier enregistrement avait un lockeduntil (blocage terminé)
            # Session en cours si :
            #   - dernier enregistrement sans lockeduntil (1 ou 2 échecs déjà)

            if last_record is None:
                nouvelle_session = True
            else:
                rec_id, count, locked_until = last_record
                # locked_until None => session active, on continue
                # locked_until expiré => blocage fini, nouvelle session
                nouvelle_session = (locked_until is not None)

            # Nouveau compteur
            new_count = 1 if nouvelle_session else (last_record[1] + 1)

            # Message et éventuel verrouillage
            if new_count >= 3:
                new_locked_until = now_utc + timedelta(minutes=1)   # UTC cohérent avec la base
                message = "Trop d'échecs. Votre IP est bloquée pendant 1 minute."
                status_code = 403
            else:
                new_locked_until = None
                restantes = 3 - new_count
                suffixe = "tentative" if restantes == 1 else "tentatives"
                message = f"Email ou mot de passe incorrect. Il vous reste {restantes} {suffixe}."
                status_code = 401

            if nouvelle_session:
                # Insertion d'une nouvelle ligne (ip_adresse n'a pas de contrainte UNIQUE)
                cur.execute("""
                    INSERT INTO loginattempts (ip_adresse, attemptcount, lastattemptat, lockeduntil)
                    VALUES (%s, %s, %s, %s)
                """, (ip, new_count, now_utc, new_locked_until))
            else:
                # Mise à jour de la ligne existante
                cur.execute("""
                    UPDATE loginattempts
                    SET attemptcount = %s, lastattemptat = %s, lockeduntil = %s
                    WHERE id = %s
                """, (new_count, now_utc, new_locked_until, last_record[0]))

            conn.commit()
            cur.close()
            conn.close()
            raise HTTPException(status_code=status_code, detail=message)

        # 5. Connexion réussie
        # On garde l'historique des blocages, on ne le nettoie pas.
        user_id, _, nom, prenom = user

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"ERREUR SQL LOGIN: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne serveur: {str(e)}")

    # Génération des tokens
    tokens = generate_tokens(data.email)

    cur.execute(
        """INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
           VALUES (%s, %s, %s, %s)""",
        (user_id, tokens["refresh_token_hash"], tokens["refresh_token_expiry"], datetime.now(TZ_FR))
    )
    conn.commit()

    response.set_cookie(
        key="refreshToken",
        value=tokens["refresh_token_raw"],
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=JWT_REFRESH_DURATION_MINUTES * 60,
        path="/"
    )

    cur.close()
    conn.close()

    return {
        "accessToken": tokens["access_token"],
        "user": {"id": user_id, "email": data.email, "nom": nom, "prenom": prenom}
    }


# ---- Renouvellement du token ----
@router.post("/refresh")
def refresh(request: Request, response: Response):
    raw_token = request.cookies.get("refreshToken")
    if not raw_token:
        raise HTTPException(status_code=401, detail="Refresh token manquant")

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        """SELECT rt.id, rt.user_id, u.email
           FROM refresh_tokens rt
           JOIN users u ON rt.user_id = u.id
           WHERE rt.token_hash = %s
           AND rt.revoked_at IS NULL
           AND rt.expires_at > %s""",
        (token_hash, datetime.now(TZ_FR))
    )
    result = cur.fetchone()

    if not result:
        cur.close()
        conn.close()
        raise HTTPException(status_code=401, detail="Refresh token invalide ou expiré")

    rt_id, user_id, email = result

    cur.execute(
        "UPDATE refresh_tokens SET revoked_at = %s WHERE id = %s",
        (datetime.now(TZ_FR), rt_id)
    )

    tokens = generate_tokens(email)

    cur.execute(
        """INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
           VALUES (%s, %s, %s, %s)""",
        (user_id, tokens["refresh_token_hash"], tokens["refresh_token_expiry"], datetime.now(TZ_FR))
    )
    conn.commit()

    response.set_cookie(
        key="refreshToken",
        value=tokens["refresh_token_raw"],
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=JWT_REFRESH_DURATION_MINUTES * 60,
        path="/"
    )

    cur.close()
    conn.close()

    return {"accessToken": tokens["access_token"]}


# ---- Déconnexion ----
@router.post("/logout")
def logout(request: Request, response: Response):
    raw_token = request.cookies.get("refreshToken")

    if raw_token:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE refresh_tokens SET revoked_at = %s WHERE token_hash = %s",
            (datetime.now(TZ_FR), token_hash)
        )
        conn.commit()
        cur.close()
        conn.close()

    response.delete_cookie(key="refreshToken", path="/")

    return {"message": "Déconnexion réussie"}


# ---- Route protégée : /me ----
@router.get("/me")
def me(payload: dict = Depends(get_current_user)):
    """
    Renvoie les infos de l'utilisateur connecté.
    Attend un header : Authorization: Bearer <access_token>
    Si absent, expiré ou invalide → 401.
    """
    email = payload.get("sub")

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, nom, prenom, email FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    return {
        "id":     user[0],
        "nom":    user[1],
        "prenom": user[2],
        "email":  user[3],
    }