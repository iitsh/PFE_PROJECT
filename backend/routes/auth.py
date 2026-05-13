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

# TZ_FR utilisé UNIQUEMENT pour les JWT
TZ_FR = ZoneInfo("Europe/Paris")

router = APIRouter()
pwd = CryptContext(schemes=["bcrypt"])

# ── Configuration JWT (depuis .env) ─────────────────────────────────────────
JWT_KEY = os.getenv("JWT_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "backend")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "pfe_frontend")
JWT_DURATION_MINUTES = int(os.getenv("JWT_DURATION_IN_MINUTES", 1))
JWT_REFRESH_DURATION_MINUTES = int(os.getenv("JWT_REFRESH_TOKEN_DURATION_IN_MINUTES", 3))


bearer_scheme = HTTPBearer()


# ═════════════════════════════════════════════════════════════════════════════
# DÉPENDANCE : VÉRIFICATION DU JWT
# ═════════════════════════════════════════════════════════════════════════════

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


# ═════════════════════════════════════════════════════════════════════════════
# VALIDATION MOT DE PASSE
# ═════════════════════════════════════════════════════════════════════════════

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
        raise HTTPException(status_code=422, detail="Critères requis : " + ", ".join(erreurs))


# ═════════════════════════════════════════════════════════════════════════════
# SERVICES JWT
# ═════════════════════════════════════════════════════════════════════════════

def generate_access_token(username: str) -> str:
    """Génère un JWT signé (Access Token)"""
    now = datetime.now(TZ_FR)   # JWT → heure Paris
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
    """Génère un Refresh Token : retourne (valeur_brute, hash, expiration)"""
    raw_token = secrets.token_urlsafe(64)
    hash_bytes = hashlib.sha256(raw_token.encode()).digest()
    token_hash = hash_bytes.hex()
    expiry = datetime.now(TZ_FR) + timedelta(minutes=JWT_REFRESH_DURATION_MINUTES)
    return (raw_token, token_hash, expiry)


def generate_tokens(username: str) -> dict:
    """Génère Access Token + Refresh Token"""
    access_token = generate_access_token(username)
    raw_refresh, hash_refresh, expiry = generate_refresh_token()
    return {
        "access_token": access_token,
        "refresh_token_raw": raw_refresh,
        "refresh_token_hash": hash_refresh,
        "refresh_token_expiry": expiry
    }


# ═════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═════════════════════════════════════════════════════════════════════════════

# ── Route Inscription ──────────────────────────────────────────────────────
@router.post("/register")
def register(data: RegisterData):
    valider_mot_de_passe(data.motDePasse)

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


# ── Route Login ──────────────────────────────────────────────────────────────
@router.post("/login")
def login(data: LoginData, response: Response, request: Request):
    ip = request.client.host

    # ⚠️  Pour tout ce qui touche à la BDD (loginattempts), on utilise
    #     datetime.utcnow() — naïf UTC — car PostgreSQL stocke les TIMESTAMP
    #     sans timezone en UTC. Mélanger avec l'heure Paris (UTC+2) casse
    #     les comparaisons et fait croire que le blocage est expiré.
    now_utc = datetime.utcnow()

    conn = get_db()
    cur = conn.cursor()

    try:
        # ── 1. Récupère la dernière ligne de tentatives pour cette IP ──────
        cur.execute("""
            SELECT id, attemptcount, lockeduntil
            FROM loginattempts
            WHERE ip_adresse = %s
            ORDER BY lastattemptat DESC
            LIMIT 1
        """, (ip,))
        last_record = cur.fetchone()

        # ── 2. Vérifie si l'IP est actuellement bloquée ───────────────────
        if last_record:
            rec_id, count, locked_until = last_record
            if locked_until and locked_until > now_utc:
                # Blocage encore actif → on refuse
                temps_restant = int((locked_until - now_utc).total_seconds())
                cur.close()
                conn.close()
                raise HTTPException(
                    status_code=403,
                    detail=f"Trop de tentatives. Votre IP est bloquée. Réessayez dans {temps_restant} secondes."
                )

        # ── 3. Cherche l'utilisateur par email ────────────────────────────
        cur.execute("SELECT id, mot_de_passe, nom, prenom FROM users WHERE email = %s", (data.email,))
        user = cur.fetchone()

        # ── 4. Mauvais identifiants ────────────────────────────────────────
        if not user or not pwd.verify(data.motDePasse, user[1]):

            # Détermine si on est dans une nouvelle session ou dans la session courante.
            #
            # NOUVELLE SESSION si :
            #   - Aucun record (premier essai de cette IP)
            #   - Le dernier record avait un lockeduntil (blocage terminé → repart à 0)
            #     → dans ce cas lockeduntil est expiré, sinon on aurait bloqué au step 2
            #
            # SESSION EN COURS si :
            #   - Le dernier record n'a pas de lockeduntil (1 ou 2 échecs en cours)

            if last_record is None:
                nouvelle_session = True
            else:
                rec_id, count, locked_until = last_record
                # locked_until is None  → session active, on continue
                # locked_until expiré   → blocage terminé, nouvelle session
                nouvelle_session = (locked_until is not None)

            # Calcule le nouveau compteur
            new_count = 1 if nouvelle_session else (last_record[1] + 1)

            # Prépare le message et le verrouillage éventuel
            if new_count >= 3:
                new_locked_until = now_utc + timedelta(minutes=1)   # UTC → cohérent avec la BDD
                message = "Trop d'échecs. Votre IP est bloquée pendant 1 minute."
                status_code = 403
            else:
                new_locked_until = None
                restantes = 3 - new_count
                suffixe = "tentative" if restantes == 1 else "tentatives"
                message = f"Email ou mot de passe incorrect. Il vous reste {restantes} {suffixe}."
                status_code = 401

            if nouvelle_session:
                # INSERT → nouvelle ligne dans l'historique
                # (⚠️ nécessite que ip_adresse n'ait PAS de contrainte UNIQUE dans la BDD)
                cur.execute("""
                    INSERT INTO loginattempts (ip_adresse, attemptcount, lastattemptat, lockeduntil)
                    VALUES (%s, %s, %s, %s)
                """, (ip, new_count, now_utc, new_locked_until))
            else:
                # UPDATE → incrémente la ligne courante de la session
                cur.execute("""
                    UPDATE loginattempts
                    SET attemptcount = %s, lastattemptat = %s, lockeduntil = %s
                    WHERE id = %s
                """, (new_count, now_utc, new_locked_until, last_record[0]))

            conn.commit()
            cur.close()
            conn.close()
            raise HTTPException(status_code=status_code, detail=message)

        # ── 5. Succès ─────────────────────────────────────────────────────
        # L'historique des blocages est conservé, on n'y touche pas.
        user_id, _, nom, prenom = user

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"ERREUR SQL LOGIN: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne serveur: {str(e)}")

    # ── Génère les tokens ──────────────────────────────────────────────────
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


# ── Route Refresh ───────────────────────────────────────────────────────────
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


# ── Route Logout ────────────────────────────────────────────────────────────
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



# ── Route Me (protégée) ──────────────────────────────────────────────────────
@router.get("/me")
def me(payload: dict = Depends(get_current_user)):
    """
    Route protégée : retourne les infos de l'utilisateur connecté.
    Le frontend doit envoyer :  Authorization: Bearer <access_token>
    Si le token est absent, expiré ou invalide → 401 automatique.
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