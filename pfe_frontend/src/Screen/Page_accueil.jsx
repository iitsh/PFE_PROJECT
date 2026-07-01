// Import des hooks React : useState (état local), useEffect (effets), useRef (références DOM)
import { useState, useEffect, useRef } from 'react';
// Import du hook de navigation React Router pour rediriger l'utilisateur
import { useNavigate } from 'react-router-dom';
// Import du composant Navbar (barre de navigation)
import Navbar from './Navbar';
// Import du thème centralisé (couleurs, tokens de design)
import { theme } from '../theme';

/* ── Icône SVG réutilisable ──────────────────────────────────────────────── */
// Composant générique pour afficher une icône SVG à partir d'un path "d"
const Icon = ({ d, size = 20, color = theme.accent }) => (
    // SVG avec dimensions paramétrables, stroke courant et coins arrondis
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

// ── Dictionnaire des icônes SVG utilisées sur la page d'accueil ───────────
const ICONS = {
    // Icône upload : importer un CV
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    // Icône coche : validation réussie
    check:  'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
    // Icône éclair : IA / génération intelligente
    spark:  'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    // Icône flèche droite : action / navigation
    arrow:  'M5 12h14 M12 5l7 7-7 7',
    // Icône horloge : historique
    clock:  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
    // Icône fichier : document CV
    file:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
};

/* ── Compteur animé : compte de 0 à target avec easing ──────────────────── */
// Composant qui anime un nombre de 0 jusqu'à la valeur cible
const AnimatedCount = ({ target, duration = 1200 }) => {
    // État local pour la valeur affichée actuellement
    const [value, setValue] = useState(0);
    // Référence pour stocker l'ID du requestAnimationFrame (pour l'annuler au démontage)
    const rafRef = useRef(null);

    // Effet déclenché quand target ou duration change
    useEffect(() => {
        // Si la cible est 0, pas besoin d'animer
        if (target === 0) return;
        // Enregistre le timestamp de début de l'animation
        const start = performance.now();
        // Fonction d'animation appelée à chaque frame
        // >>> requestAnimationFrame(callback) = API native du navigateur qui
        //     appelle callback juste avant le prochain rafraîchissement
        //     d'écran (~60 fois/seconde) — plus fluide et performant que
        //     setInterval() car synchronisé avec le taux de rafraîchissement
        //     réel de l'écran de l'utilisateur.
        const tick = (now) => {
            // Calcule la progression (0 à 1) en fonction du temps écoulé
            const progress = Math.min((now - start) / duration, 1);
            // Applique un easing cubique (décélération progressive)
            // >>> 1 - Math.pow(1-progress, 3) = fonction d'"easing" — au lieu
            //     d'une progression linéaire (vitesse constante), le compteur
            //     ralentit en approchant de la valeur finale, effet plus naturel.
            const ease = 1 - Math.pow(1 - progress, 3);
            // Met à jour la valeur affichée avec l'arrondi
            setValue(Math.round(target * ease));
            // Continue l'animation si pas encore terminée
            if (progress < 1) rafRef.current = requestAnimationFrame(tick);
        };
        // Démarre la boucle d'animation
        rafRef.current = requestAnimationFrame(tick);
        // Nettoyage : annule l'animation au démontage du composant
        // >>> Fonction de "cleanup" du useEffect — s'exécute si le composant
        //     est retiré de l'écran AVANT la fin de l'animation (ex: l'utilisateur
        //     navigue ailleurs) — évite une fuite mémoire / un setState sur un
        //     composant démonté (React lèverait un warning sinon).
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]); // Dépendances : relance si target ou duration change

    // Affiche la valeur animée (fragment pour éviter un span inutile)
    return <>{value}</>;
};

/* ── Mockup CV flottant : illustration décorative dans le hero ──────────── */
// Composant visuel simulant un aperçu de CV avec un badge IA
// >>> Composant purement DÉCORATIF — aucune donnée réelle, aucun état,
//     aucun appel API. Les barres grises simulent visuellement un CV
//     (largeurs variables pour un effet réaliste) sans jamais afficher de
//     vraies informations utilisateur.
const CvMockup = () => (
    // Conteneur principal : carte blanche avec ombre et légère rotation
    <div style={{
        background: '#fff',
        borderRadius: 12,
        border: `1px solid ${theme.border}`, // Bordure subtile
        boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)', // Double ombre
        padding: '20px 20px',
        width: 220,
        transform: 'rotate(2deg)', // Légère inclinaison pour effet dynamique
        position: 'relative',
        flexShrink: 0, // Ne rétrécit pas dans le flexbox
    }}>
        {/* Badge IA en haut à droite */}
        <div style={{
            position: 'absolute', top: -10, right: -10,
            background: theme.accent, color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '3px 8px',
            borderRadius: 99, letterSpacing: '.04em',
        }}>IA</div>

        {/* Header du CV mockup : avatar + nom simulés */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {/* Avatar circulaire avec icône utilisateur */}
            <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: theme.accentMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={theme.accent} strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                </svg>
            </div>
            {/* Barres simulant le nom et le titre du CV */}
            <div>
                <div style={{ width: 80, height: 8, background: theme.text, borderRadius: 4 }} />
                <div style={{ width: 55, height: 6, background: theme.textMuted, borderRadius: 4, marginTop: 4 }} />
            </div>
        </div>
        {/* Lignes simulées : représentent le contenu du CV (largeurs variées) */}
        {[100, 85, 90, 70, 95, 60, 80, 65].map((w, i) => (
            <div key={i} style={{
                height: 6,
                width: `${w}%`, // Largeur variable pour effet réaliste
                background: i === 0 ? theme.accentLight : theme.borderLight, // Première ligne en accent
                borderRadius: 4,
                marginBottom: 6,
            }} />
        ))}
        {/* Label de section simulé (barre accentuée) */}
        <div style={{
            marginTop: 12, marginBottom: 8,
            height: 7, width: '50%',
            background: theme.accentMuted, borderRadius: 4,
        }} />
        {/* Second groupe de lignes (section formations/compétences) */}
        {[90, 75, 80].map((w, i) => (
            <div key={i} style={{
                height: 6, width: `${w}%`,
                background: theme.borderLight, borderRadius: 4, marginBottom: 5,
            }} />
        ))}
    </div>
);

/* ── Carte étape : affiche une étape du processus ───────────────────────── */
// Composant réutilisable pour les 3 étapes : importer, vérifier, générer
const StepCard = ({ number, icon, iconColor, label, desc, accent, style = {} }) => (
    // Conteneur de la carte avec fond personnalisable et interactions hover
    <div style={{
        background: accent || theme.surfaceAlt, // Couleur de fond (accent ou gris clair)
        padding: '32px 28px',
        display: 'flex', flexDirection: 'column', gap: 14,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease', // Animation douce au hover
        cursor: 'default',
        ...style, // Styles supplémentaires passés en prop
    }}
        // Effet au survol : soulève légèrement + ajoute une ombre
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = theme.shadowMd;
        }}
        // Retour à l'état normal quand la souris quitte
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
        }}
    >
        {/* En-tête : icône + badge numéro d'étape */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Icon d={ICONS[icon]} size={22} color={iconColor} />
            <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                color: iconColor, textTransform: 'uppercase',
                background: `${iconColor}18`, padding: '3px 8px', borderRadius: 99, // Fond semi-transparent
            }}>
                Étape {number}
            </span>
        </div>
        {/* Titre de l'étape */}
        <p style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0, lineHeight: 1.25 }}>
            {label}
        </p>
        {/* Description de l'étape */}
        <p style={{ fontSize: 14, color: theme.textSecondary, margin: 0, lineHeight: 1.65 }}>
            {desc}
        </p>
    </div>
);

/* ══ Page Accueil : landing page après connexion ════════════════════════════ */
// Props : accessToken (JWT pour les appels API), setAccessToken (mise à jour du token)
export const Page_accueil = ({ accessToken, setAccessToken }) => {
    // Hook de navigation pour rediriger vers d'autres pages
    const navigate = useNavigate();
    // État pour le nombre de CV générés (affiché dans le compteur)
    const [cvCount, setCvCount] = useState(0);

    // Effet au montage : récupère le nombre de CV de l'utilisateur depuis l'API
    // >>> Réutilise la MÊME route /api/cv/history que Page_historique.jsx —
    //     mais ici on ne s'intéresse qu'à data.length (le compte), pas au
    //     contenu détaillé. Pas de route dédiée "count" côté backend, donc
    //     le frontend récupère la liste complète et compte lui-même.
    useEffect(() => {
        // Fonction asynchrone pour fetcher l'historique
        const fetchCvCount = async () => {
            try {
                // Appel GET vers l'endpoint d'historique
                const res = await fetch('http://localhost:8000/api/cv/history', {
                    headers: { Authorization: `Bearer ${accessToken}` }, // Envoie le JWT
                });
                if (res.ok) {
                    const data = await res.json();
                    // Le nombre de CV = longueur du tableau d'historique
                    setCvCount(data.length);
                }
            } catch (e) { console.error(e); } // Erreur réseau ignorée
        };
        fetchCvCount();
    }, [accessToken]); // Relance si le token change (reconnexion)

    return (
        <>
            {/* ── Styles scopés pour la page d'accueil ── */}
            <style>{`
                /* Racine de la page : hauteur minimale plein écran */
                .acc-root { min-height: 100vh; background: var(--bg); }

                /* Hero : section principale avec texte + mockup CV */
                .acc-hero {
                    max-width: 1200px; margin: 0 auto;
                    padding: 72px 32px 56px;
                    display: flex; justify-content: space-between;
                    align-items: center; gap: 48px; flex-wrap: wrap;
                }
                /* Colonne gauche du hero : largeur max pour la lisibilité */
                .acc-hero-left { max-width: 56ch; }
                /* Badge "eyebrow" : petit texte au-dessus du titre */
                .acc-eyebrow {
                    font-size: 12px; font-weight: 600;
                    color: var(--accent); text-transform: uppercase;
                    letter-spacing: .08em; margin: 0 0 16px;
                    display: flex; align-items: center; gap: 8px;
                }
                /* Pilule du badge eyebrow */
                .acc-eyebrow-pill {
                    background: var(--accent-muted);
                    padding: 3px 10px; border-radius: 99px;
                    border: 1px solid var(--accent-light);
                }
                /* Titre principal H1 : grande taille, gras */
                .acc-h1 {
                    font-size: clamp(2rem, 4vw, 2.75rem); /* Taille responsive */
                    font-weight: 800; color: var(--text);
                    letter-spacing: -0.03em; line-height: 1.08;
                    margin: 0 0 18px;
                }
                /* Texte gradient sur "générés par IA" */
                .acc-h1 span {
                    background: linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%);
                    -webkit-background-clip: text; /* Applique le gradient au texte */
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                /* Sous-titre descriptif */
                .acc-sub {
                    font-size: 16.5px; color: var(--text-secondary);
                    line-height: 1.7; margin: 0 0 32px; max-width: 46ch;
                }
                /* Conteneur des boutons d'action (CTA) */
                .acc-ctas { display: flex; gap: 10px; flex-wrap: wrap; }
                /* Bouton primaire : fond accent, texte blanc, forme pilule */
                .acc-btn-primary {
                    background: var(--accent); color: #fff;
                    border: none; border-radius: 9999px;
                    padding: 13px 30px; font-size: 14.5px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: background 0.15s, transform 0.1s;
                    display: flex; align-items: center; gap: 7px;
                }
                /* Hover bouton primaire : accent plus foncé */
                .acc-btn-primary:hover { background: var(--accent-hover); }
                /* Click bouton primaire : légère réduction */
                .acc-btn-primary:active { transform: scale(0.97); }
                /* Bouton secondaire : transparent avec bordure */
                .acc-btn-secondary {
                    background: transparent; color: var(--text);
                    border: 1.5px solid var(--border);
                    border-radius: 9999px; padding: 13px 26px;
                    font-size: 14.5px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: border-color 0.15s, background 0.15s;
                }
                /* Hover bouton secondaire : bordure accent + fond accent léger */
                .acc-btn-secondary:hover {
                    border-color: var(--accent);
                    background: var(--accent-muted);
                    color: var(--accent);
                }

                /* Bande statistique : compteur de CV générés */
                .acc-stat {
                    display: flex; flex-direction: column; align-items: flex-start;
                    gap: 4px; padding-left: 32px;
                    border-left: 3px solid var(--accent-light); /* Bordure gauche accentuée */
                }
                /* Nombre du compteur : très grande taille */
                .acc-stat-num {
                    font-size: 3.5rem; font-weight: 800; color: var(--accent);
                    line-height: 1; letter-spacing: -0.04em;
                }
                /* Label sous le compteur */
                .acc-stat-label { font-size: 13px; color: var(--text-muted); font-weight: 500; }

                /* Diviseur horizontal entre les sections */
                .acc-divider { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
                .acc-divider-line { height: 1px; background: var(--border); }

                /* Section des 3 étapes */
                .acc-steps-section { max-width: 1200px; margin: 0 auto; padding: 56px 32px; }
                /* Titre de la section étapes */
                .acc-steps-title {
                    font-size: 11.5px; font-weight: 700;
                    color: var(--text-muted); text-transform: uppercase;
                    letter-spacing: .1em; margin: 0 0 28px;
                }
                /* Grille des étapes : 3 colonnes avec lignes de séparation via gap+background */
                .acc-steps-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    grid-template-rows: auto auto;
                    gap: 2px; /* Espace entre les cartes (simule des bordures) */
                    background: var(--border); /* Couleur des "bordures" entre cartes */
                    border-radius: 14px;
                    overflow: hidden;
                }
                /* Étape large : occupe 2 colonnes */
                .acc-step-wide  { grid-column: 1 / 3; }
                /* Étape pleine largeur : occupe les 3 colonnes */
                .acc-step-full  { grid-column: 1 / 4; }

                /* Bande CTA en bas de page */
                .acc-cta-band {
                    background: var(--bg-alt);
                    border-top: 1px solid var(--border);
                }
                /* Contenu interne du CTA */
                .acc-cta-inner {
                    max-width: 1200px; margin: 0 auto;
                    padding: 52px 32px;
                    display: flex; justify-content: space-between;
                    align-items: center; flex-wrap: wrap; gap: 24px;
                }
                /* Titre du CTA final */
                .acc-cta-title {
                    font-size: 1.25rem; font-weight: 700;
                    color: var(--text); margin: 0 0 4px;
                }
                /* Sous-titre du CTA final */
                .acc-cta-sub {
                    font-size: 14.5px; color: var(--text-secondary); margin: 0;
                }

                /* Animation d'entrée : fondu + glissement vers le haut */
                .acc-fade-in { animation: accFade 0.4s ease both; }
                @keyframes accFade {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                /* Délais échelonnés pour chaque enfant */
                .acc-fade-in:nth-child(2) { animation-delay: 0.08s; }
                .acc-fade-in:nth-child(3) { animation-delay: 0.16s; }

                /* Responsive : tablette et mobile */
                @media (max-width: 900px) {
                    .acc-hero { flex-direction: column; align-items: flex-start; padding: 48px 20px 40px; }
                    .acc-steps-grid { grid-template-columns: 1fr; } /* 1 seule colonne en mobile */
                    .acc-step-wide, .acc-step-full { grid-column: 1 / 2; }
                    .acc-cta-inner { flex-direction: column; align-items: flex-start; }
                }
                /* Très petit écran : cache le mockup CV */
                @media (max-width: 480px) {
                    .acc-mockup-wrap { display: none; }
                }
            `}</style>

            <div className="acc-root">
                {/* Barre de navigation en haut */}
                <Navbar connected={true} accessToken={accessToken} setAccessToken={setAccessToken} />

                {/* ── Section Hero : titre principal + mockup CV ── */}
                <div className="acc-hero acc-fade-in">
                    {/* Colonne gauche : texte d'accroche */}
                    <div className="acc-hero-left">
                        {/* Badge eyebrow au-dessus du titre */}
                        <p className="acc-eyebrow">
                            <span className="acc-eyebrow-pill">Intelligent CV builder</span>
                        </p>
                        {/* Titre principal avec texte en gradient */}
                        <h1 className="acc-h1">
                            Des CV sur mesure,<br />
                            <span>générés par IA</span>
                        </h1>
                        {/* Sous-titre descriptif */}
                        <p className="acc-sub">
                            Importez votre CV existant, collez une offre d'emploi — obtenez un CV parfaitement adapté en quelques secondes.
                        </p>
                        {/* Boutons d'action : générer un CV ou voir l'historique */}
                        <div className="acc-ctas">
                            {/* Bouton primaire : redirige vers la page de création */}
                            <button className="acc-btn-primary" onClick={() => navigate('/nouveau-cv')}>
                                Générer un CV
                                <Icon d={ICONS.arrow} size={15} color="#fff" />
                            </button>
                            {/* Bouton secondaire : redirige vers l'historique */}
                            <button className="acc-btn-secondary" onClick={() => navigate('/historique')}>
                                Historique
                            </button>
                        </div>
                    </div>

                    {/* Colonne droite : mockup CV + compteur de CV générés */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 28 }}>
                        {/* Illustration décorative du CV */}
                        <div className="acc-mockup-wrap">
                            <CvMockup />
                        </div>
                        {/* Statistique : nombre de CV générés par l'utilisateur */}
                        <div className="acc-stat">
                            <span className="acc-stat-num">
                                {/* Compteur animé de 0 à cvCount */}
                                <AnimatedCount target={cvCount} />
                            </span>
                            <span className="acc-stat-label">CV générés</span>
                        </div>
                    </div>
                </div>

                {/* Diviseur horizontal */}
                <div className="acc-divider">
                    <div className="acc-divider-line" />
                </div>

                {/* ── Section des 3 étapes du processus ── */}
                <div className="acc-steps-section">
                    <p className="acc-steps-title">Processus en 3 étapes</p>
                    <div className="acc-steps-grid">
                        {/* Étape 1 : Importer le CV (carte large, 2 colonnes) */}
                        <div className="acc-step-wide" style={{ background: theme.accentMuted }}>
                            <StepCard
                                number={1}
                                icon="upload"
                                iconColor={theme.accent}
                                label="Importer votre CV"
                                desc="Téléchargez votre CV existant en PDF. L'IA extrait automatiquement vos compétences, expériences et formations."
                                style={{ height: '100%' }}
                            />
                        </div>
                        {/* Étape 2 : Vérifier le profil (carte normale, fond vert clair) */}
                        <div style={{ background: '#F0FDF4' }}>
                            <StepCard
                                number={2}
                                icon="check"
                                iconColor={theme.success}
                                label="Vérifier le profil"
                                desc="Validez et complétez les données extraites avant de générer votre CV."
                                style={{ height: '100%' }}
                            />
                        </div>
                        {/* Étape 3 : Générer le CV (pleine largeur, fond accent fort) */}
                        <div className="acc-step-full" style={{
                            background: theme.accent, padding: '28px 32px',
                            display: 'flex', alignItems: 'center', gap: 24,
                            cursor: 'default',
                        }}>
                            {/* Cercle avec icône éclair sur fond semi-transparent */}
                            <div style={{
                                width: 44, height: 44, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Icon d={ICONS.spark} size={22} color="#fff" />
                            </div>
                            {/* Texte de l'étape 3 */}
                            <div>
                                <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                                    Générer un CV sur mesure
                                </p>
                                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.75)', margin: 0 }}>
                                    Collez une offre d'emploi et obtenez un CV parfaitement adapté — en quelques secondes.
                                </p>
                            </div>
                            {/* Bouton d'action "Commencer" aligné à droite */}
                            <button
                                onClick={() => navigate('/nouveau-cv')}
                                style={{
                                    marginLeft: 'auto',
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    color: '#fff', borderRadius: 9999,
                                    padding: '9px 20px', fontSize: 13.5,
                                    fontWeight: 600, cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'background 0.15s ease',
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                }}
                                // Hover : fond plus opaque
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                                // Retour normal quand la souris quitte
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                            >
                                Commencer →
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Bande CTA finale : encouragement à commencer ── */}
                <div className="acc-cta-band">
                    <div className="acc-cta-inner">
                        {/* Texte d'encouragement */}
                        <div>
                            <p className="acc-cta-title">Prêt à commencer ?</p>
                            <p className="acc-cta-sub">Créez votre premier CV optimisé en quelques clics.</p>
                        </div>
                        {/* Bouton d'action : redirige vers la création de CV */}
                        <button
                            className="acc-btn-primary"
                            onClick={() => navigate('/nouveau-cv')}
                        >
                            Commencer gratuitement
                            <Icon d={ICONS.arrow} size={15} color="#fff" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// Export par défaut du composant Page_accueil
export default Page_accueil;