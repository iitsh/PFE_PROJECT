# BaseModel = classe de base Pydantic, valide automatiquement les types
# des champs reçus dans le body JSON d'une requête HTTP
from pydantic import BaseModel
from datetime import datetime
# Optional[X] = le champ peut être de type X OU None
from typing import Optional


# DTO = objet qui ne fait que transporter/valider les données d'une requête
# Utilisé dans routes/auth.py : def register(data: RegisterData)
class RegisterData(BaseModel):
    nom: str
    prenom: str
    email: str
    motDePasse: str   # texte brut ici, haché plus tard avec bcrypt
    numero: str


# Utilisé dans routes/auth.py : def login(data: LoginData, ...)
class LoginData(BaseModel):
    email: str
    motDePasse: str


# Ne sert pas à valider une requête HTTP — documente la structure
# de la table SQL refresh_tokens (créée dans init_db.py)
class RefreshToken(BaseModel):
    id: int
    user_id: int
    token_hash: str          # jamais le token brut, toujours son hash SHA-256
    expires_at: datetime
    created_at: datetime
    # Optional + = None : valeur par défaut si absente, donc champ facultatif
    revoked_at: Optional[datetime] = None