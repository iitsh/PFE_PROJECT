from fastapi import FastAPI                          # le framework principal
from fastapi.middleware.cors import CORSMiddleware   # permet à React de communiquer avec le backend
from routes.auth import router as auth_router        # importe les routes d'authentification

app = FastAPI()  # crée l'application FastAPI

# Configure le CORS : autorise React (port 5173) à envoyer des requêtes au backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # adresse de ton React
    allow_methods=["*"],                      # autorise tous les types de requêtes (GET, POST...)
    allow_headers=["*"],                      # autorise tous les en-têtes HTTP
    allow_credentials=True                    # autorise les cookies (HttpOnly)
)

# Connecte les routes d'authentification avec le préfixe /api/auth
app.include_router(auth_router, prefix="/api/auth")
# Résultat : /api/auth/register et /api/auth/login