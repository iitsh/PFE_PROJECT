from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from routes.auth import router as auth_router
from routes.cv import router as cv_router


# Middleware = code exécuté sur CHAQUE requête, avant/après la route
class CSPMiddleware(BaseHTTPMiddleware):
    """Ajoute des headers de sécurité à chaque réponse HTTP."""

    # dispatch() = méthode obligatoire de tout middleware Starlette,
    # appelée automatiquement par le framework sur chaque requête
    async def dispatch(self, request: Request, call_next):
        # call_next(request) = exécute le reste de la chaîne (autres
        # middlewares + la route finale), retourne la réponse générée
        response = await call_next(request)

        # CSP = dit au navigateur d'où il peut charger scripts/styles/images
        # protège contre les attaques XSS (injection de scripts malveillants)
        csp_directives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            "img-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        # .join() = fusionne la liste en une seule chaîne séparée par "; "
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # nosniff = empêche le navigateur de deviner le type d'un fichier
        response.headers["X-Content-Type-Options"] = "nosniff"
        # empêche le site d'être chargé dans une iframe d'un autre domaine (clickjacking)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        # limite les infos d'URL envoyées en cliquant vers un autre site
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # désactive caméra/micro/géoloc, inutiles pour cette appli
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        return response


# FastAPI() = crée l'instance du serveur. Le nom "app" est obligatoire
# car "uvicorn main:app" cherche cette variable exacte au démarrage
app = FastAPI()

# add_middleware() = enregistre un middleware. L'ORDRE D'AJOUT COMPTE :
# CSP ajouté en premier = s'applique même sur les erreurs des middlewares suivants
app.add_middleware(CSPMiddleware)

# CORSMiddleware = middleware natif FastAPI, autorise le frontend (autre port)
# à appeler ce backend malgré la politique Same-Origin du navigateur
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # seule origine autorisée
    allow_methods=["*"],                        # toutes méthodes HTTP (GET/POST/PUT)
    allow_headers=["*"],                        # tous headers (dont Authorization: Bearer)
    allow_credentials=True,                     # AUTORISE l'envoi des cookies cross-origin
    # ⚠️ indispensable pour que le cookie refreshToken soit transmis
    # ⚠️ incompatible avec allow_origins=["*"] selon la spec CORS
)

# include_router() = branche les routes d'un fichier sur l'app, avec un préfixe
# /login dans auth.py devient accessible sur /api/auth/login
app.include_router(auth_router, prefix="/api/auth")
app.include_router(cv_router, prefix="/api/cv")