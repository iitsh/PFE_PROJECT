from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class RegisterData(BaseModel):
    nom: str
    prenom: str
    email: str
    motDePasse: str
    numero: str


class LoginData(BaseModel):
    email: str
    motDePasse: str


class RefreshToken(BaseModel):
    id: int
    user_id: int
    token_hash: str         
    expires_at: datetime     
    created_at: datetime     
    revoked_at: Optional[datetime] = None 