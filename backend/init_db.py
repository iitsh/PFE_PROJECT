# Importe psycopg2 pour la connexion à PostgreSQL
import psycopg2
# Importe os pour accéder aux variables d'environnement
import os
# Importe load_dotenv pour charger les variables du fichier .env
from dotenv import load_dotenv

# ── Fonction principale : crée toutes les tables SQL nécessaires ─────────────
# >>> Script à exécuter UNE SEULE FOIS manuellement (python init_db.py),
#     PAS appelé automatiquement par main.py au démarrage du serveur.
# >>> IMPORTANT : ce script ne crée PAS les tables users, loginattempts,
#     et refresh_tokens (utilisées dans routes/auth.py) — elles doivent
#     déjà exister, créées séparément. Ce fichier complète seulement les
#     tables "enfants" du profil CV + ajoute des colonnes à users existante.
def create_tables():
    # Charge les variables d'environnement depuis le fichier .env
    load_dotenv()
    # Ouvre une connexion à la base PostgreSQL via l'URL stockée dans .env
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    # Crée un curseur pour exécuter les requêtes SQL
    cur = conn.cursor()

    # ── Exécute un bloc SQL multi-requêtes ───────────────────────────────────
    # >>> cur.execute() avec un bloc SQL contenant PLUSIEURS instructions
    #     séparées par ";" — psycopg2 les exécute toutes en une fois.
    # >>> "user_id INT REFERENCES users(id) ON DELETE CASCADE" = clé étrangère.
    #     CASCADE signifie que si un utilisateur est supprimé, TOUTES ses
    #     expériences/formations/etc. sont automatiquement supprimées aussi
    #     — c'est la relation de COMPOSITION vue dans le diagramme de classes
    #     (l'enfant ne peut pas exister sans son parent User).
    cur.execute('''
    -- ══ Table experience : stocke les expériences professionnelles de chaque utilisateur ══
    CREATE TABLE IF NOT EXISTS experience (
        id_experience SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        poste VARCHAR(300) NOT NULL,
        entreprise VARCHAR(300) NOT NULL,
        date_debut VARCHAR(50),
        date_fin VARCHAR(50),
        description TEXT,
        lieu VARCHAR(200)
    );

    -- ══ Table formation : stocke les diplômes et formations de chaque utilisateur ══
    CREATE TABLE IF NOT EXISTS formation (
        id_formation SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        diplome VARCHAR(300) NOT NULL,
        etablissement VARCHAR(300) NOT NULL,
        date_debut VARCHAR(50),
        date_fin VARCHAR(50),
        description TEXT,
        lieu VARCHAR(200)
    );

    -- ══ Table competence : stocke les compétences catégorisées de chaque utilisateur ══
    CREATE TABLE IF NOT EXISTS competence (
        id_competence SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        nom_competence VARCHAR(200) NOT NULL,
        niveau VARCHAR(50),
        categorie VARCHAR(200) NOT NULL
    );

    -- ══ Table projet : stocke les projets personnels ou académiques ══
    CREATE TABLE IF NOT EXISTS projet (
        id_projet SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        nom VARCHAR(300),
        description TEXT,
        technologies TEXT
    );

    -- ══ Table langue : stocke les langues parlées par l'utilisateur ══
    CREATE TABLE IF NOT EXISTS langue (
        id_langue SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        nom_langue VARCHAR(100),
        niveau VARCHAR(50)
    );

    -- ══ Table cv : stocke les CV générés avec leur contenu JSON ══
    -- >>> JSONB (et pas TEXT) = type PostgreSQL natif qui stocke un JSON
    --     de façon binaire indexable, et permet d'interroger ses champs
    --     directement en SQL si besoin (contenu_cv->>'nom' par exemple).
    CREATE TABLE IF NOT EXISTS cv (
        id_cv SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        date_generation TIMESTAMP DEFAULT NOW(),
        format VARCHAR(50) DEFAULT 'PDF',
        resume_professionnel TEXT,
        contenu_cv JSONB NOT NULL,
        statut VARCHAR(50) DEFAULT 'Généré',
        nom_fichier VARCHAR(255) NOT NULL,
        chemin_fichier VARCHAR(255) NOT NULL
    );

    -- ══ Ajoute des colonnes supplémentaires à la table users (si elles n'existent pas) ══
    -- >>> ADD COLUMN IF NOT EXISTS = migration idempotente : on peut relancer
    --     ce script plusieurs fois sans erreur, même si les colonnes existent
    --     déjà — pratique pour faire évoluer le schéma sans tout recréer.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ville VARCHAR(200);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin VARCHAR(300);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS github VARCHAR(300);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio VARCHAR(300);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS resume TEXT;
    ''')

    # Valide (commit) toutes les modifications dans la base de données
    conn.commit()
    # Ferme le curseur
    cur.close()
    # Ferme la connexion à la base
    conn.close()
    # Affiche un message de confirmation
    print("Tables SQL créées avec succès.")

# ── Point d'entrée : exécute create_tables() si le script est lancé directement ──
# >>> if __name__ == "__main__" : ce bloc ne s'exécute QUE si on lance
#     "python init_db.py" directement — pas si ce fichier est importé
#     ailleurs (ce qui n'est jamais le cas dans ce projet, mais c'est la
#     convention standard pour rendre un script Python réutilisable comme
#     module ET exécutable directement).
if __name__ == "__main__":
    create_tables()