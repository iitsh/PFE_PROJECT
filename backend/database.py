# ══════════════════════════════════════════════════════════════════════════════
#  Connexion PostgreSQL — backend CV Generator (PFE)
#  Fournit get_db() utilisée par routes/auth.py et routes/cv.py
# ══════════════════════════════════════════════════════════════════════════════

# psycopg2 = driver Python pour PostgreSQL (envoie/reçoit les requêtes SQL)
import psycopg2
# load_dotenv() = lit le fichier .env et charge ses variables dans os.environ
from dotenv import load_dotenv
import os

# Exécuté une seule fois, au chargement du module
load_dotenv()


# get_db() = ouvre une NOUVELLE connexion PostgreSQL à chaque appel
# Appelée dans chaque route qui a besoin de la BDD (auth.py, cv.py)
def get_db():
    # os.getenv() = lit la variable DATABASE_URL définie dans le .env
    # psycopg2.connect() = ouvre la connexion TCP + authentifie + sélectionne la DB
    return psycopg2.connect(os.getenv("DATABASE_URL"))