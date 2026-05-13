import psycopg2        # librairie pour se connecter à PostgreSQL
from dotenv import load_dotenv  # pour lire les variables du fichier .env
import os              # pour accéder aux variables d'environnement

load_dotenv()          # charge le fichier .env

# Fonction qui ouvre et retourne une connexion à la base de données
def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL"))