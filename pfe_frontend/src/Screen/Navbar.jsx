// Import du module React pour la création de composants JSX
import React from 'react';
// Import de Link pour la navigation entre pages et useLocation pour détecter la route active
import { Link, useLocation } from 'react-router-dom';
// Import du thème centralisé (couleurs, tokens de design)
import { theme } from '../theme';

/* ── Logo mark : icône SVG de la marque CVGen ────────────────────────────── */
// Composant fonctionnel qui affiche le logo SVG de l'application
// >>> ATTENTION SOUTENANCE : dans le fichier source original, les commentaires
//     à l'intérieur des balises SVG (rect/path) sont écrits avec "//" au lieu
//     de "{/* ... */}" — c'est INVALIDE en JSX entre deux balises, ça casserait
//     la compilation. Ci-dessous, la syntaxe correcte a été utilisée.
const Logo = () => (
    // SVG de 30×30 pixels avec viewBox pour la mise à l'échelle
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        {/* Rectangle arrondi de fond avec la couleur d'accent du thème */}
        <rect width="30" height="30" rx="8" fill={theme.accent} />
        {/* Trois lignes horizontales simulant du texte de CV */}
        <path d="M8 9h8M8 13h11M8 17h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        {/* Chevron en bas à droite symbolisant l'action / la génération */}
        <path d="M20 17l3 3-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/* ── Icône SVG générique réutilisable ────────────────────────────────────── */
// Composant qui accepte un path SVG "d" et l'affiche en 15×15 pixels
// >>> Pattern de composant réutilisable : au lieu de dupliquer 7 fois la
//     structure <svg><path/></svg>, un seul composant paramétré par "d"
//     (le tracé SVG) sert pour toutes les icônes du fichier.
const NavIcon = ({ d }) => (
    // SVG avec stroke courant pour hériter de la couleur du parent
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Le chemin SVG passé en prop "d" */}
        <path d={d} />
    </svg>
);

// ── Dictionnaire des icônes SVG utilisées dans la navigation ───────────────
// Chaque clé correspond à un identifiant d'icône, la valeur est le path SVG
// >>> Pattern "lookup table" : au lieu d'un if/else ou switch pour choisir
//     l'icône, on indexe directement ICONS[icon] — plus court, extensible
//     (ajouter une icône = ajouter une ligne, pas une branche de condition).
const ICONS = {
    // Icône maison : page d'accueil
    home:    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    // Icône document + : créer un nouveau CV
    newcv:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v6 M9 14h6',
    // Icône horloge : historique des CV
    history: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
    // Icône utilisateur : profil du compte
    profil:  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    // Icône déconnexion : quitter la session
    logout:  'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
    // Icône hamburger : menu mobile (3 lignes horizontales)
    menu:    'M4 6h16M4 12h16M4 18h16',
    // Icône croix : fermer le menu mobile
    close:   'M18 6L6 18M6 6l12 12',
};

// ── Configuration des liens de navigation ──────────────────────────────────
// Tableau d'objets définissant chaque lien : route, icône et label
const NAV_LINKS = [
    // Lien vers la page d'accueil
    { to: '/accueil',    icon: 'home',    label: 'Accueil'    },
    // Lien vers la page de création de CV
    { to: '/nouveau-cv', icon: 'newcv',   label: 'Nouveau CV' },
    // Lien vers l'historique des CV générés
    { to: '/historique', icon: 'history', label: 'Historique' },
    // Lien vers la page profil utilisateur
    { to: '/profil',     icon: 'profil',  label: 'Profil'     },
];

/* ── Composant principal de la barre de navigation ───────────────────────── */
// Props : connected (booléen connexion), accessToken (JWT), setAccessToken (mise à jour du token)
// >>> "connected" est calculé par le composant PARENT (généralement
//     !!accessToken), pas par la Navbar elle-même — elle ne fait que
//     réagir à cette prop pour afficher ou masquer les liens.
export const Navbar = ({ connected, accessToken, setAccessToken }) => {
    // Hook React Router pour obtenir l'URL actuelle (utilisé pour surligner le lien actif)
    const location = useLocation();
    // État local pour contrôler l'ouverture/fermeture du menu mobile
    const [menuOpen, setMenuOpen] = React.useState(false);

    // ── Fonction de déconnexion : appelle l'API puis nettoie l'état ───────
    // >>> Le nettoyage local (setAccessToken(null)) s'exécute MÊME si
    //     l'appel réseau échoue (catch vide) — l'utilisateur doit pouvoir
    //     se déconnecter localement même si le serveur est injoignable.
    //     Le vrai logout côté serveur (révocation du refresh token en BDD)
    //     est un "bonus" tenté, mais pas bloquant pour l'UX.
    const handleLogout = async () => {
        try {
            // Appel POST vers le serveur pour supprimer le refresh token (cookie HTTP-only)
            await fetch('http://localhost:8000/api/auth/logout', {
                method: 'POST', credentials: 'include', // Envoie les cookies avec la requête
            });
        } catch (e) { console.error(e); } // Erreur réseau ignorée, on nettoie quand même
        // Supprime l'access token de l'état React (déconnexion côté client)
        setAccessToken(null);
        // Ferme le menu mobile s'il était ouvert
        setMenuOpen(false);
    };

    // ── Vérifie si un chemin correspond à la route actuelle ────────────────
    const isActive = (path) => location.pathname === path;

    return (
        // Fragment React pour regrouper le style et le nav
        <>
            {/* ── Styles scopés : CSS injecté uniquement pour ce composant ── */}
            <style>{`
                /* Barre de navigation principale : hauteur fixe, sticky en haut */
                .cvg-nav {
                    height: 56px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 24px;
                    border-bottom: 1px solid var(--border); /* Bordure basse subtile */
                    background: rgba(255,255,255,0.88); /* Blanc semi-transparent */
                    backdrop-filter: blur(14px); /* Effet de flou d'arrière-plan */
                    -webkit-backdrop-filter: blur(14px); /* Compatibilité Safari */
                    position: sticky; /* Reste collée en haut au scroll */
                    top: 0;
                    z-index: 100; /* Au-dessus de tout le contenu */
                }
                /* Mode sombre : fond sombre semi-transparent */
                @media (prefers-color-scheme: dark) {
                    .cvg-nav { background: rgba(15,23,42,0.88); }
                }

                /* Brand : lien vers l'accueil contenant le logo et le nom */
                .cvg-brand {
                    text-decoration: none; /* Pas de soulignement */
                    display: flex;
                    align-items: center;
                    gap: 10px; /* Espace entre logo et texte */
                    user-select: none; /* Empêche la sélection du texte */
                }
                /* Nom de la marque "CVGen" */
                .cvg-brand-name {
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--text);
                    letter-spacing: -0.02em; /* Espacement légèrement réduit */
                }
                /* Point coloré après "CVGen" en couleur d'accent */
                .cvg-brand-dot { color: var(--accent); }

                /* Lien de navigation individuel (icône + texte) */
                .cvg-link {
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 6px; /* Espace entre icône et label */
                    font-size: 13.5px;
                    font-weight: 500;
                    padding: 6px 11px;
                    border-radius: 7px; /* Coins arrondis */
                    transition: background 0.13s ease, color 0.13s ease; /* Animation douce */
                    color: var(--text-secondary); /* Couleur secondaire par défaut */
                    white-space: nowrap; /* Empêche le retour à la ligne */
                }
                /* Effet hover : fond gris clair + texte principal */
                .cvg-link:hover {
                    background: var(--bg-alt);
                    color: var(--text);
                }
                /* Lien actif (page courante) : fond accent léger + texte accent */
                .cvg-link.cvg-active {
                    background: var(--accent-muted);
                    color: var(--accent);
                    font-weight: 600; /* Plus gras pour indiquer la page active */
                }

                /* Bouton de déconnexion (style texte, pas de bordure) */
                .cvg-logout {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    padding: 6px 11px;
                    border-radius: 7px;
                    border: none; /* Pas de bordure visible */
                    background: transparent; /* Fond transparent */
                    color: var(--text-muted); /* Couleur atténuée */
                    cursor: pointer;
                    transition: background 0.13s ease, color 0.13s ease;
                    font-family: inherit; /* Hérite de la police parente */
                    white-space: nowrap;
                }
                /* Hover déconnexion : fond rouge clair + texte rouge */
                .cvg-logout:hover {
                    background: var(--error-light);
                    color: var(--error);
                }

                /* Séparateur vertical entre les liens et la déconnexion */
                .cvg-sep {
                    width: 1px;
                    height: 18px;
                    background: var(--border);
                    margin: 0 4px;
                    flex-shrink: 0; /* Ne rétrécit pas */
                }

                /* Conteneur des liens en mode desktop (flexbox horizontal) */
                .cvg-desktop {
                    display: flex;
                    align-items: center;
                    gap: 2px; /* Espacement minimal entre les liens */
                }

                /* Bouton hamburger pour mobile (masqué en desktop) */
                .cvg-hamburger {
                    display: none; /* Caché par défaut, affiché en mobile */
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 7px;
                    color: var(--text);
                    transition: background 0.13s ease;
                }
                /* Hover hamburger : fond gris clair */
                .cvg-hamburger:hover { background: var(--bg-alt); }

                /* Menu mobile déroulant (position fixe sous la navbar) */
                .cvg-mobile-menu {
                    position: fixed;
                    top: 56px; /* Juste sous la navbar de 56px */
                    left: 0;
                    right: 0;
                    background: var(--bg); /* Fond opaque */
                    border-bottom: 1px solid var(--border);
                    padding: 8px 16px 16px;
                    z-index: 99; /* Sous la navbar (100) */
                    display: flex;
                    flex-direction: column; /* Liens empilés verticalement */
                    gap: 2px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.08); /* Ombre portée */
                    animation: slideDown 0.18s ease; /* Animation d'entrée */
                }
                /* Liens dans le menu mobile : taille de police plus grande */
                .cvg-mobile-menu .cvg-link {
                    font-size: 14.5px;
                    padding: 10px 12px;
                }
                /* Bouton déconnexion dans le menu mobile */
                .cvg-mobile-menu .cvg-logout {
                    font-size: 14.5px;
                    padding: 10px 12px;
                }
                /* Séparateur horizontal dans le menu mobile */
                .cvg-mobile-sep {
                    height: 1px;
                    background: var(--border);
                    margin: 6px 0;
                }

                /* Animation de glissement vers le bas pour le menu mobile */
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); } /* Départ : invisible et décalé */
                    to   { opacity: 1; transform: translateY(0); }    /* Arrivée : visible et en place */
                }

                /* Responsive : en dessous de 768px, cache desktop et affiche hamburger */
                @media (max-width: 768px) {
                    .cvg-desktop    { display: none !important; } /* Masque les liens desktop */
                    .cvg-hamburger  { display: flex !important; } /* Affiche le bouton hamburger */
                }
            `}</style>

            {/* ── Barre de navigation HTML ── */}
            <nav className="cvg-nav">
                {/* Brand : lien cliquable vers l'accueil avec logo + nom */}
                <Link to="/accueil" className="cvg-brand">
                    <Logo />
                    <span className="cvg-brand-name">
                        CVGen<span className="cvg-brand-dot">.</span>
                    </span>
                </Link>

                {/* Affiche les liens de navigation uniquement si l'utilisateur est connecté */}
                {connected && (
                    <>
                        {/* ── Navigation desktop : liens horizontaux ── */}
                        <div className="cvg-desktop">
                            {/* Parcourt chaque lien de navigation et génère un Link React Router */}
                            {/* >>> .map() génère un <Link> par entrée de NAV_LINKS — le tableau
                                    de config centralise tous les liens, évite de dupliquer 4 fois
                                    la même structure JSX. "key={to}" est OBLIGATOIRE pour que
                                    React identifie chaque élément de liste de façon stable. */}
                            {NAV_LINKS.map(({ to, icon, label }) => (
                                <Link
                                    key={to} // Clé unique pour React (la route)
                                    to={to}  // Destination du lien
                                    // Ajoute la classe "cvg-active" si la route est active
                                    className={`cvg-link ${isActive(to) ? 'cvg-active' : ''}`}
                                >
                                    {/* Icône SVG correspondant à la clé de l'icône */}
                                    <NavIcon d={ICONS[icon]} />
                                    {/* Label textuel du lien */}
                                    {label}
                                </Link>
                            ))}
                            {/* Séparateur vertical avant le bouton déconnexion */}
                            <div className="cvg-sep" />
                            {/* Bouton de déconnexion */}
                            <button className="cvg-logout" onClick={handleLogout}>
                                <NavIcon d={ICONS.logout} />
                                Déconnexion
                            </button>
                        </div>

                        {/* ── Bouton hamburger mobile (visible uniquement < 768px) ── */}
                        <button
                            className="cvg-hamburger"
                            // Bascule l'état d'ouverture du menu mobile
                            onClick={() => setMenuOpen(v => !v)}
                            // Texte alternatif pour l'accessibilité
                            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                        >
                            {/* SVG qui change selon l'état : croix (fermer) ou hamburger (ouvrir) */}
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                {menuOpen
                                    // Menu ouvert : affiche une croix (X)
                                    ? <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
                                    // Menu fermé : affiche trois lignes horizontales
                                    : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>
                                }
                            </svg>
                        </button>

                        {/* ── Menu mobile déroulant (affiché uniquement si menuOpen est true) ── */}
                        {menuOpen && (
                            <div className="cvg-mobile-menu">
                                {/* Même liens que le desktop mais empilés verticalement */}
                                {NAV_LINKS.map(({ to, icon, label }) => (
                                    <Link
                                        key={to}
                                        to={to}
                                        className={`cvg-link ${isActive(to) ? 'cvg-active' : ''}`}
                                        // Ferme le menu après un clic sur un lien
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <NavIcon d={ICONS[icon]} />
                                        {label}
                                    </Link>
                                ))}
                                {/* Séparateur horizontal avant le bouton déconnexion */}
                                <div className="cvg-mobile-sep" />
                                {/* Bouton de déconnexion dans le menu mobile */}
                                <button className="cvg-logout" onClick={handleLogout}>
                                    <NavIcon d={ICONS.logout} />
                                    Déconnexion
                                </button>
                            </div>
                        )}
                    </>
                )}
            </nav>
        </>
    );
};

// Export par défaut du composant Navbar pour les imports simples
export default Navbar;