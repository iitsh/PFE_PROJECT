// Import des hooks React : useState (état local), useEffect (effets au montage)
import { useState, useEffect } from 'react';
// Import du hook de navigation pour les redirections
import { useNavigate } from 'react-router-dom';
// Import du composant Navbar (barre de navigation)
import Navbar from './Navbar';
// Import du thème centralisé (couleurs, tokens de design)
import { theme } from '../theme';

// ── Icône SVG réutilisable : affiche un path SVG avec taille et couleur ───
// Composant générique pour toutes les icônes de cette page
const Icon = ({ d, size = 18, color = theme.accent }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} /> {/* Chemin SVG à dessiner */}
    </svg>
);

// ── Dictionnaire des icônes SVG utilisées dans l'historique ───────────────
const ICONS = {
    clock:  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2', // Horloge
    file:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6', // Fichier
    eye:    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', // Œil
    x:      'M18 6L6 18M6 6l12 12', // Croix de fermeture
    spark:  'M13 2L3 14h9l-1 8 10-12h-9l1-8z', // Éclair / IA
    arrow:  'M5 12h14 M12 5l7 7-7 7', // Flèche droite
    cal:    'M3 9h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M8 2v3M16 2v3', // Calendrier
};

// ── Formate une date ISO en format français lisible ───────────────────────
// Ex: "2025-05-01T14:30:00Z" → "1 mai 2025, 14:30"
// >>> toLocaleDateString('fr-FR', {...}) = API native du navigateur pour le
//     formatage de dates localisé — pas besoin de bibliothèque externe
//     (comme date-fns ou moment.js) pour ce besoin simple.
const formaterDate = (str) => {
    if (!str) return 'Date inconnue'; // Fallback si pas de date
    return new Date(str).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', // Jour + mois en lettres + année
        hour: '2-digit', minute: '2-digit', // Heure et minutes
    });
};

// ── Extrait le titre du poste pour l'affichage dans la liste ──────────────
// Combine entreprise + titre, ou utilise le premier emploi, ou "CV généré"
// >>> Chaîne de FALLBACKS en cascade : essaie la meilleure info disponible
//     (entreprise + titre de l'offre ciblée), puis dégrade progressivement
//     jusqu'à un texte générique — garantit qu'un titre s'affiche TOUJOURS,
//     même si le contenu JSON stocké est incomplet ou malformé.
const extrairePoste = (contenu) => {
    try {
        let titre = '';
        // Cas 1 : entreprise + titre d'offre disponibles
        if (contenu?.entreprise_offre && contenu?.titre_offre) {
            titre = `${contenu.entreprise_offre} — ${contenu.titre_offre}`;
        // Cas 2 : uniquement le titre d'offre
        } else if (contenu?.titre_offre) {
            titre = contenu.titre_offre;
        // Cas 3 : utilise le titre de la première expérience
        } else if (contenu?.experiences?.length > 0) {
            titre = contenu.experiences[0].titre;
        // Cas 4 : fallback générique
        } else {
            titre = 'CV généré';
        }
        
        // Limiter la longueur pour que ça reste bref dans la carte
        if (titre.length > 55) return titre.substring(0, 55) + '...';
        return titre; // Retourne le titre complet si assez court
    } catch (_) {} // Ignore toute erreur de parsing
    return 'CV généré'; // Fallback ultime
};

// ── Extrait le nom complet (prénom + nom) depuis le contenu du CV ────────
const extraireNom = (contenu) => {
    if (!contenu) return ''; // Retourne vide si pas de contenu
    return `${contenu.prenom || ''} ${contenu.nom || ''}`.trim(); // Combine et nettoie
};

// ══ Page Historique : affiche la liste des CV générés avec aperçu modal ════
// Permet de consulter tous les CV créés et de les visualiser dans une modale
export const Page_historique = ({ accessToken, setAccessToken }) => {
    const navigate = useNavigate(); // Hook de navigation pour les redirections

    // ── États locaux du composant ──────────────────────────────────────────────
    const [historique,   setHistorique]   = useState([]); // Liste des CV de l'utilisateur
    const [loading,      setLoading]      = useState(true); // Chargement de l'historique
    const [selectedCV,   setSelectedCV]   = useState(null); // CV sélectionné pour l'aperçu modal
    const [cvHtml,       setCvHtml]       = useState(''); // HTML du CV pour l'iframe
    const [lettreHtml,   setLettreHtml]   = useState(''); // HTML de la lettre de motivation
    const [showLettre,   setShowLettre]   = useState(false); // Affiche la lettre ou le CV
    const [loadingModal, setLoadingModal] = useState(false); // Chargement du contenu modal

    // ── Effet au montage : charge la liste des CV depuis l'API ────────────────
    useEffect(() => {
        const fetch_ = async () => {
            try {
                // Appelle le endpoint d'historique avec le token JWT
                const res = await fetch('http://localhost:8000/api/cv/history', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!res.ok) throw new Error(); // Erreur HTTP
                setHistorique(await res.json()); // Stocke la liste des CV
            } catch (_) {
                console.error("Erreur chargement historique"); // Log l'erreur
            } finally {
                setLoading(false); // Fin du chargement
            }
        };
        fetch_();
    }, [accessToken]); // Re-exécute si le token change

    // ── Ouvre la modale d'aperçu pour un CV spécifique ───────────────────────
    // >>> LAZY LOADING : la liste (/history) ne contient QUE les métadonnées
    //     (titre, date) — le HTML complet du CV n'est chargé qu'au moment où
    //     l'utilisateur clique pour l'ouvrir (GET /html/{id_cv}). Évite de
    //     télécharger tous les CV complets d'un coup si l'utilisateur en a
    //     des dizaines dans son historique.
    const ouvrirModal = async (cv) => {
        setSelectedCV(cv); // Marque le CV comme sélectionné (affiche la modale)
        setLoadingModal(true); // Active le spinner dans la modale
        try {
            // Appelle le endpoint pour obtenir le HTML du CV
            // >>> Route routes/cv.py : vérifie que ce CV appartient bien à
            //     l'utilisateur connecté (WHERE id_cv = ? AND user_id = ?)
            //     avant de renvoyer le HTML — contrôle d'autorisation.
            const res = await fetch(`http://localhost:8000/api/cv/html/${cv.id_cv}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = res.ok ? await res.json() : null; // Parse la réponse si OK
            setCvHtml(data?.html_cv ?? '<p style="padding:20px;color:#DC2626">Erreur de chargement</p>'); // HTML du CV ou erreur
            setLettreHtml(data?.html_lettre ?? ''); // HTML de la lettre (vide si absente)
            setShowLettre(false); // Affiche le CV par défaut
        } catch (_) {
            // En cas d'erreur, affiche un message dans l'iframe
            setCvHtml('<p style="padding:20px;color:#DC2626">Erreur de chargement</p>');
            setLettreHtml('');
            setShowLettre(false);
        } finally {
            setLoadingModal(false); // Désactive le spinner
        }
    };

    // ── Ferme la modale et réinitialise les états ────────────────────────────
    const fermerModal = () => { setSelectedCV(null); setCvHtml(''); setLettreHtml(''); setShowLettre(false); };

    return (
        <>
            {/* ── Styles CSS intégrés pour la page historique ── */}
            <style>{`
                /* ── Racine de la page ── */
                .his-root { min-height: 100vh; background: var(--bg-alt); } /* Pleine hauteur, fond alternatif */

                /* ── En-tête de la page ── */
                .his-header { max-width: 1000px; margin: 0 auto; padding: 40px 32px 0; } /* Centré, padding haut */
                .his-eyebrow {
                    font-size: 11px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: .08em;
                    color: var(--accent); margin: 0 0 10px;
                    display: flex; align-items: center; gap: 6px; /* Icône + texte */
                }
                .his-h1 {
                    font-size: 1.75rem; font-weight: 800;
                    color: var(--text); margin: 0 0 6px;
                    letter-spacing: -0.02em;
                }
                .his-sub { font-size: 14px; color: var(--text-secondary); margin: 0; } /* Description */

                /* ── Zone de contenu ── */
                .his-content { max-width: 1000px; margin: 0 auto; padding: 28px 32px 64px; } /* Centré */

                /* ── Spinner de chargement ── */
                .his-spinner-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 80px 0; }
                .his-spinner {
                    width: 36px; height: 36px; border-radius: 50%;
                    border: 3px solid var(--border); /* Bordure grise */
                    border-top-color: var(--accent); /* Haut coloré (crée l'effet) */
                    animation: hisSpin .8s linear infinite;
                }
                @keyframes hisSpin { to { transform: rotate(360deg); } } /* Rotation complète */

                /* ── État vide : aucun CV généré ── */
                .his-empty {
                    background: var(--bg); /* Fond principal */
                    border: 1.5px solid var(--border); /* Bordure */
                    border-radius: 14px; padding: 72px 32px;
                    display: flex; flex-direction: column;
                    align-items: center; gap: 16px; text-align: center;
                }
                .his-empty-icon {
                    width: 60px; height: 60px; border-radius: 16px;
                    background: var(--bg-alt); /* Fond alternatif */
                    border: 1.5px solid var(--border);
                    display: flex; align-items: center; justify-content: center;
                }
                .his-empty-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
                .his-empty-sub   { font-size: 14px; color: var(--text-secondary); margin: 0; max-width: 40ch; }

                /* ── Liste des CV ── */
                .his-list { display: flex; flex-direction: column; gap: 12px; } /* Espacement entre cartes */

                /* ── Carte individuelle d'un CV ── */
                .his-card {
                    background: var(--bg); border: 1.5px solid var(--border);
                    border-radius: 12px; padding: 20px 24px;
                    display: flex; align-items: center;
                    justify-content: space-between; gap: 16px;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }
                .his-card:hover {
                    border-color: var(--accent); /* Bordure accent au hover */
                    box-shadow: 0 2px 12px rgba(37,99,235,0.08); /* Ombre légère */
                }
                .his-card-left { flex: 1; min-width: 0; } /* Prend tout l'espace restant */
                .his-card-title {
                    font-size: 15px; font-weight: 700;
                    color: var(--text); margin: 0 0 3px;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; /* Tronque si trop long */
                }
                .his-card-name { font-size: 13px; color: var(--text-secondary); margin: 0 0 8px; } /* Nom du candidat */
                .his-card-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } /* Métadonnées */
                .his-meta-date {
                    font-size: 12px; color: var(--text-muted);
                    display: flex; align-items: center; gap: 5px; /* Icône + date */
                }
                .his-badge {
                    font-size: 11.5px; font-weight: 600;
                    border-radius: 9999px; padding: 3px 11px;
                    display: inline-block; /* Badge arrondi */
                }
                .his-badge-green { background: var(--success-light, #F0FDF4); color: #16A34A; } /* Badge vert (Généré) */
                .his-badge-gray  { background: var(--bg-alt); color: var(--text-muted); } /* Badge gris (format) */

                /* ── Bouton "Voir" sur chaque carte ── */
                .his-btn-voir {
                    display: flex; align-items: center; gap: 7px;
                    background: var(--accent-muted); color: var(--accent);
                    border: 1.5px solid var(--accent-light);
                    border-radius: 9999px; padding: 8px 18px;
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    white-space: nowrap; flex-shrink: 0;
                    transition: background 0.13s ease;
                }
                .his-btn-voir:hover { background: var(--accent-light); } /* Hover plus foncé */

                /* ── Bouton CTA principal (page vide) ── */
                .his-btn-primary {
                    background: var(--accent); color: #fff;
                    border: none; border-radius: 9999px;
                    padding: 12px 26px; font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    display: flex; align-items: center; gap: 8px;
                    transition: background 0.15s ease;
                }
                .his-btn-primary:hover { background: var(--accent-hover); } /* Hover : accent foncé */

                /* ── Overlay de la modale (fond semi-transparent) ── */
                .his-overlay {
                    position: fixed; inset: 0; /* Couvre tout l'écran */
                    background: rgba(0,0,0,0.55); /* Fond noir semi-transparent */
                    z-index: 1000; /* Au-dessus de tout */
                    display: flex; align-items: center; justify-content: center;
                    padding: 24px;
                    animation: hisFadeIn 0.18s ease; /* Fondu d'apparition */
                }
                @keyframes hisFadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* ── Boîte de la modale ── */
                .his-modal {
                    background: var(--bg); border-radius: 16px;
                    width: 100%; max-width: 860px; /* Largeur max */
                    max-height: 92vh; /* Hauteur max */
                    display: flex; flex-direction: column;
                    overflow: hidden; /* Cache le débordement */
                    box-shadow: 0 20px 60px rgba(0,0,0,0.22); /* Ombre prononcée */
                    animation: hisSlideUp 0.2s ease; /* Glisse vers le haut */
                }
                @keyframes hisSlideUp {
                    from { opacity: 0; transform: translateY(16px); } /* Départ en bas */
                    to   { opacity: 1; transform: translateY(0); } /* Arrivée en place */
                }
                /* En-tête de la modale avec titre + bouton fermer */
                .his-modal-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 24px;
                    border-bottom: 1px solid var(--border); /* Séparateur */
                    flex-shrink: 0; /* Ne rétrécit pas */
                }
                .his-modal-title { font-size: 15px; font-weight: 700; color: var(--text); margin: 0; }
                .his-modal-close {
                    width: 32px; height: 32px; border-radius: 8px;
                    background: none; border: none;
                    color: var(--text-muted); cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: background 0.13s ease, color 0.13s ease;
                }
                .his-modal-close:hover { background: var(--bg-alt); color: var(--text); } /* Hover */
                .his-modal-body { flex: 1; overflow: auto; background: var(--bg-alt); } /* Corps scrollable */
                .his-modal-loading {
                    display: flex; flex-direction: column;
                    align-items: center; gap: 12px; padding: 64px;
                }

                /* ── Responsive mobile (< 640px) ── */
                @media (max-width: 640px) {
                    .his-header, .his-content { padding-left: 20px; padding-right: 20px; }
                    .his-card { flex-direction: column; align-items: flex-start; } /* Colonne au lieu de ligne */
                    .his-btn-voir { align-self: flex-end; } /* Bouton à droite */
                    .his-header { padding-top: 28px; }
                }

                /* ── Onglets CV / Lettre dans la modale ── */
                .his-tab-btn {
                    background: var(--bg-alt); color: var(--text-muted);
                    border: 1px solid var(--border);
                    border-radius: 9999px; padding: 6px 16px;
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; transition: all 0.2s;
                }
                .his-tab-btn.active {
                    background: var(--accent); /* Fond accent quand actif */
                    color: white; border-color: var(--accent);
                }
            `}</style>

            {/* ── Conteneur principal de la page ── */}
            <div className="his-root">
                {/* Barre de navigation */}
                <Navbar connected accessToken={accessToken} setAccessToken={setAccessToken} />

                {/* ── En-tête avec titre et description ── */}
                <div className="his-header">
                    <p className="his-eyebrow">
                        <Icon d={ICONS.clock} size={13} /> {/* Icône horloge */}
                        Historique
                    </p>
                    <h1 className="his-h1">Vos CV générés</h1> {/* Titre principal */}
                    <p className="his-sub">Retrouvez et consultez tous vos CV créés avec CVGen.</p> {/* Description */}
                </div>

                {/* ── Zone de contenu ── */}
                <div className="his-content">

                    {/* ── État de chargement : spinner ── */}
                    {loading && (
                        <div className="his-spinner-wrap">
                            <div className="his-spinner" />
                            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
                                Chargement de l'historique…
                            </p>
                        </div>
                    )}

                    {/* ── État vide : aucun CV généré ── */}
                    {!loading && historique.length === 0 && (
                        <div className="his-empty">
                            <div className="his-empty-icon">
                                <Icon d={ICONS.file} size={26} color={theme.textMuted} /> {/* Icône fichier */}
                            </div>
                            <p className="his-empty-title">Aucun CV généré</p> {/* Titre */}
                            <p className="his-empty-sub">
                                Vous n'avez pas encore créé de CV. Rendez-vous sur le générateur pour en créer un.
                            </p>
                            <button className="his-btn-primary" onClick={() => navigate('/nouveau-cv')}>
                                Générer un CV {/* Bouton d'action */}
                                <Icon d={ICONS.arrow} size={15} color="#fff" />
                            </button>
                        </div>
                    )}

                    {/* ── Liste des CV générés ── */}
                    {!loading && historique.length > 0 && (
                        <div className="his-list">
                            {historique.map((cv) => (
                                <div key={cv.id_cv} className="his-card"> {/* Carte par CV */}
                                    <div className="his-card-left">
                                        <p className="his-card-title">{extrairePoste(cv.contenu_cv)}</p> {/* Titre du poste */}
                                        {extraireNom(cv.contenu_cv) && (
                                            <p className="his-card-name">{extraireNom(cv.contenu_cv)}</p> /* Nom du candidat */
                                        )}
                                        <div className="his-card-meta">
                                            <span className="his-meta-date">
                                                <Icon d={ICONS.cal} size={12} color={theme.textMuted} />
                                                {formaterDate(cv.date_generation)} {/* Date formatée */}
                                            </span>
                                            <span className={`his-badge ${cv.statut === 'Généré' ? 'his-badge-green' : 'his-badge-gray'}`}>
                                                {cv.statut || 'Généré'} {/* Badge de statut */}
                                            </span>
                                            <span className="his-badge his-badge-gray">
                                                {cv.format || 'PDF'} {/* Badge de format */}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="his-btn-voir" onClick={() => ouvrirModal(cv)}>
                                        <Icon d={ICONS.eye} size={14} color="currentColor" />
                                        Voir les documents {/* Bouton d'aperçu */}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ══ Modale d'aperçu du CV / lettre de motivation ══ */}
            {selectedCV && (
                <div className="his-overlay" onClick={fermerModal}> {/* Overlay : ferme au clic */}
                    <div className="his-modal" onClick={e => e.stopPropagation()}> {/* Empêche la propagation */}
                        {/* ── En-tête de la modale ── */}
                        <div className="his-modal-header">
                            <p className="his-modal-title">{extrairePoste(selectedCV.contenu_cv)}</p> {/* Titre du CV */}
                            <button className="his-modal-close" onClick={fermerModal} aria-label="Fermer">
                                <Icon d={ICONS.x} size={16} color="currentColor" /> {/* Bouton fermer */}
                            </button>
                        </div>
                        {/* ── Corps de la modale ── */}
                        <div className="his-modal-body">
                            {loadingModal ? (
                                /* Spinner pendant le chargement du HTML */
                                <div className="his-modal-loading">
                                    <div className="his-spinner" />
                                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
                                        Chargement du document…
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {/* ── Onglets CV / Lettre (si lettre disponible) ── */}
                                    {lettreHtml && (
                                        <div style={{ display: 'flex', gap: 10, padding: '16px 24px 0', justifyContent: 'center' }}>
                                            <button className={`his-tab-btn ${!showLettre ? 'active' : ''}`} onClick={() => setShowLettre(false)}>
                                                CV {/* Onglet CV */}
                                            </button>
                                            <button className={`his-tab-btn ${showLettre ? 'active' : ''}`} onClick={() => setShowLettre(true)}>
                                                Lettre de motivation {/* Onglet lettre */}
                                            </button>
                                        </div>
                                    )}
                                    {/* ── Iframe d'aperçu ── */}
                                    <div style={{ flex: 1, padding: 16 }}>
                                        {(!showLettre && cvHtml) ? (
                                            <iframe srcDoc={cvHtml} style={{ width: '100%', height: '75vh', border: '1px solid var(--border)', borderRadius: 8, background: 'white' }} title="Aperçu du CV" />
                                        ) : (showLettre && lettreHtml) ? (
                                            <iframe srcDoc={lettreHtml} style={{ width: '100%', height: '75vh', border: '1px solid var(--border)', borderRadius: 8, background: 'white' }} title="Aperçu de la lettre" />
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Page_historique; // Export par défaut du composant