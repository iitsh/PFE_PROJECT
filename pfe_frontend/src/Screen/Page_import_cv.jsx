// Import des hooks useState (état) et useRef (référence DOM pour l'input file)
import { useState, useRef } from 'react';
// Import du hook de navigation pour rediriger vers la génération de CV
import { useNavigate } from 'react-router-dom';
// Import du composant Navbar (barre de navigation)
import Navbar from './Navbar';
// Import du thème centralisé (couleurs, tokens)
import { theme } from '../theme';

// ── Icône SVG réutilisable ────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = theme.accent }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

// ── Dictionnaire des icônes SVG utilisées sur cette page ──────────────────
const ICONS = {
    upload:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12', // Upload
    file:    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6', // Fichier
    check:   'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3', // Coche verte
    user:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', // Utilisateur
    briefcase:'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', // Mallette
    book:    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', // Livre
    tool:    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z', // Outil
    arrow:   'M5 12h14 M12 5l7 7-7 7', // Flèche droite
    refresh: 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15', // Rafraîchir
};

// ── Composant principal de la page d'import de CV ─────────────────────────
// Props : accessToken (JWT), setAccessToken (mise à jour du token)
export const Page_import_cv = ({ accessToken, setAccessToken }) => {
    // Hook de navigation pour rediriger après validation
    const navigate  = useNavigate();
    // Référence vers l'input file caché (pour déclencher le clic programmatiquement)
    const inputRef  = useRef();

    // Étape actuelle : 'upload' (zone de dépôt) ou 'resultats' (données extraites)
    const [etape,    setEtape]    = useState('upload');
    // État de chargement pendant l'analyse du PDF
    const [loading,  setLoading]  = useState(false);
    // État pour le survol drag & drop (bordure accentuée)
    const [dragOver, setDragOver] = useState(false);
    // Données du profil extraites du CV par l'IA
    const [profil,   setProfil]   = useState(null);

    // ── Traitement du fichier PDF sélectionné ─────────────────────────────
    const handleFichier = async (file) => {
        // Vérifie que le fichier existe et est un PDF
        if (!file || file.type !== 'application/pdf') return;
        setLoading(true); // Active le spinner
        // Crée un FormData pour envoyer le fichier
        // >>> FormData() = objet natif du navigateur qui construit une
        //     requête "multipart/form-data" — le SEUL format capable de
        //     transporter un fichier binaire dans une requête HTTP.
        //     Contrairement à JSON.stringify(), pas de header Content-Type
        //     à préciser manuellement, le navigateur le fait automatiquement
        //     avec la bonne "boundary".
        const fd = new FormData();
        fd.append('file', file); // Ajoute le fichier au formulaire
        try {
            // Appel POST vers l'API de parsing de CV
            const res = await fetch('http://localhost:8000/api/cv/parse', {
                method: 'POST',
                // >>> Pas de Content-Type ici volontairement — le navigateur
                //     le définit lui-même pour FormData (avec la boundary).
                headers: { Authorization: `Bearer ${accessToken}` }, // JWT requis
                body: fd, // Envoie le fichier
            });
            if (!res.ok) throw new Error("Erreur lors de l'analyse du PDF");
            // Récupère les données extraites par l'IA
            const data = await res.json();
            setProfil(data); // Stocke le profil extrait
            // Sauvegarde aussi dans sessionStorage pour la page de génération
            // >>> IMPORTANT : /api/cv/parse ne sauvegarde PAS en BDD (voir
            //     routes/cv.py) — les données ne sont conservées QUE dans
            //     sessionStorage, un stockage navigateur temporaire (effacé
            //     à la fermeture de l'onglet). C'est ce qui permet à
            //     Page_nouveau_cv.jsx de récupérer ce profil sans re-parser
            //     le PDF, avant que l'utilisateur ne clique "Enregistrer".
            sessionStorage.setItem('profilImporte', JSON.stringify(data));
            setEtape('resultats'); // Passe à la vue résultats
        } catch (e) {
            console.error(e);
            alert(e.message); // Affiche l'erreur à l'utilisateur
        } finally {
            setLoading(false); // Désactive le spinner
        }
    };

    // ── Gestion du drop de fichier (glisser-déposer) ─────────────────────
    // >>> e.preventDefault() est OBLIGATOIRE ici : sans lui, le navigateur
    //     tente d'OUVRIR le fichier déposé dans un nouvel onglet au lieu
    //     de déclencher l'événement onDrop personnalisé.
    const handleDrop = (e) => {
        e.preventDefault(); // Empêche le comportement par défaut du navigateur
        setDragOver(false); // Réinitialise l'état de survol
        handleFichier(e.dataTransfer.files[0]); // Traite le premier fichier déposé
    };

    return (
        <>
            {/* ── Styles scopés pour la page d'import ── */}
            <style>{`
                /* Racine : fond alternatif, hauteur minimale */
                .imp-root { min-height: 100vh; background: var(--bg-alt); }

                /* ── En-tête de la page ── */
                .imp-header { max-width: 900px; margin: 0 auto; padding: 40px 32px 0; }
                /* Badge eyebrow au-dessus du titre */
                .imp-eyebrow {
                    font-size: 11px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: .08em;
                    color: var(--accent); margin: 0 0 10px;
                    display: flex; align-items: center; gap: 6px;
                }
                /* Titre principal */
                .imp-h1 {
                    font-size: 1.75rem; font-weight: 800;
                    color: var(--text); margin: 0 0 6px;
                    letter-spacing: -0.02em;
                }
                /* Sous-titre descriptif */
                .imp-sub { font-size: 14px; color: var(--text-secondary); margin: 0; }

                /* ── Contenu principal ── */
                .imp-content { max-width: 900px; margin: 0 auto; padding: 28px 32px 64px; }

                /* ── Zone de dépôt (drag & drop) ── */
                .imp-dropzone {
                    background: var(--bg);
                    border: 2px dashed var(--border); /* Bordure pointillée */
                    border-radius: 14px;
                    padding: 72px 32px;
                    display: flex; flex-direction: column;
                    align-items: center; gap: 16px;
                    cursor: pointer; /* Indique qu'on peut cliquer */
                    transition: border-color 0.15s ease, background 0.15s ease;
                    text-align: center;
                }
                /* Hover ou drag-over : bordure accent + fond accent léger */
                .imp-dropzone:hover, .imp-dropzone.drag-over {
                    border-color: var(--accent);
                    background: var(--accent-muted);
                }
                /* Icône de la zone de dépôt (carré arrondi avec icône upload) */
                .imp-drop-icon {
                    width: 56px; height: 56px; border-radius: 14px;
                    background: var(--accent-muted);
                    display: flex; align-items: center; justify-content: center;
                }
                /* Titre "Déposez votre CV ici" */
                .imp-drop-title {
                    font-size: 1.05rem; font-weight: 700;
                    color: var(--text); margin: 0;
                }
                /* Sous-titre "ou cliquez..." */
                .imp-drop-sub { font-size: 13.5px; color: var(--text-secondary); margin: 0; }
                /* Badge "PDF uniquement" */
                .imp-badge {
                    font-size: 11px; font-weight: 700;
                    background: var(--bg-alt);
                    border: 1.5px solid var(--border);
                    border-radius: 6px; padding: 4px 10px;
                    color: var(--text-secondary);
                    letter-spacing: .04em;
                }

                /* ── Spinner de chargement ── */
                .imp-spinner-wrap {
                    display: flex; flex-direction: column;
                    align-items: center; gap: 16px; padding: 72px 32px;
                }
                /* Cercle qui tourne (animation) */
                .imp-spinner {
                    width: 40px; height: 40px; border-radius: 50%;
                    border: 3px solid var(--border);
                    border-top-color: var(--accent);
                    animation: impSpin .8s linear infinite;
                }
                @keyframes impSpin { to { transform: rotate(360deg); } }

                /* ── Bannière de succès (après analyse réussie) ── */
                .imp-success {
                    display: flex; align-items: center; gap: 14px;
                    background: var(--success-light, #F0FDF4); /* Fond vert clair */
                    border: 1px solid rgba(22,163,74,.2);
                    border-radius: 12px;
                    padding: 16px 20px; margin-bottom: 24px;
                }
                /* Cercle vert avec coche blanche */
                .imp-success-icon {
                    width: 34px; height: 34px; border-radius: 50%;
                    background: #16A34A;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                /* Titre de la bannière succès */
                .imp-success-title { font-size: 14px; font-weight: 700; color: #15803D; margin: 0 0 2px; }
                /* Sous-titre de la bannière */
                .imp-success-sub   { font-size: 13px; color: #166534; margin: 0; }

                /* ── Carte de section (infos, expériences, etc.) ── */
                .imp-card {
                    background: var(--bg);
                    border: 1.5px solid var(--border);
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 16px;
                }
                /* Titre de section dans la carte */
                .imp-section-title {
                    font-size: 13px; font-weight: 700;
                    color: var(--text); margin: 0 0 16px;
                    display: flex; align-items: center; gap: 8px;
                    text-transform: uppercase; letter-spacing: .05em;
                }

                /* ── Grille d'informations personnelles (3 colonnes) ── */
                .imp-info-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                /* Cellule d'information individuelle */
                .imp-info-cell {
                    background: var(--bg-alt);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 12px 14px;
                }
                /* Label de la cellule (Prénom, Email, etc.) */
                .imp-cell-label { font-size: 11px; color: var(--text-muted); margin: 0 0 4px; font-weight: 600; }
                /* Valeur de la cellule */
                .imp-cell-value { font-size: 13.5px; font-weight: 600; color: var(--text); margin: 0; word-break: break-word; }

                /* ── Carte d'expérience ou formation ── */
                .imp-exp-item {
                    background: var(--bg-alt);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 14px 16px;
                    margin-bottom: 8px;
                }
                /* Titre de l'expérience (poste ou diplôme) */
                .imp-exp-title   { font-size: 14px; font-weight: 700; color: var(--text); margin: 0 0 3px; }
                /* Entreprise ou établissement + durée + lieu */
                .imp-exp-company { font-size: 12.5px; color: var(--text-secondary); margin: 0 0 4px; }
                /* Description détaillée */
                .imp-exp-desc    { font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5; }

                /* ── Pilule de compétence ── */
                .imp-pill {
                    display: inline-flex; align-items: center;
                    background: var(--accent-muted);
                    border: 1px solid var(--accent-light);
                    color: var(--accent);
                    border-radius: 9999px;
                    padding: 5px 13px;
                    font-size: 12px; font-weight: 600;
                }

                /* ── Boutons d'action en bas ── */
                .imp-actions {
                    display: flex; gap: 12px;
                    justify-content: flex-end; /* Alignés à droite */
                    margin-top: 24px;
                }
                /* Bouton primaire : fond accent */
                .imp-btn-primary {
                    background: var(--accent); color: #fff;
                    border: none; border-radius: 9999px;
                    padding: 12px 28px; font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    display: flex; align-items: center; gap: 8px;
                    transition: background 0.15s ease;
                }
                .imp-btn-primary:hover { background: var(--accent-hover); }
                /* Bouton secondaire : transparent avec bordure */
                .imp-btn-secondary {
                    background: transparent; color: var(--text);
                    border: 1.5px solid var(--border);
                    border-radius: 9999px; padding: 12px 24px;
                    font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: border-color 0.15s ease;
                }
                .imp-btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

                /* Responsive mobile */
                @media (max-width: 600px) {
                    .imp-header, .imp-content { padding-left: 20px; padding-right: 20px; }
                    .imp-info-grid { grid-template-columns: 1fr 1fr; } /* 2 colonnes au lieu de 3 */
                    .imp-actions { flex-direction: column; } /* Boutons empilés */
                    .imp-btn-primary, .imp-btn-secondary { justify-content: center; }
                }
            `}</style>

            <div className="imp-root">
                {/* Barre de navigation */}
                <Navbar connected accessToken={accessToken} setAccessToken={setAccessToken} />

                {/* ── En-tête de la page ── */}
                <div className="imp-header">
                    <p className="imp-eyebrow">
                        <Icon d={ICONS.upload} size={13} />
                        Import de CV
                    </p>
                    {/* Titre dynamique selon l'étape */}
                    <h1 className="imp-h1">
                        {etape === 'upload' ? 'Importez votre CV' : 'CV analysé'}
                    </h1>
                    {/* Sous-titre dynamique selon l'étape */}
                    <p className="imp-sub">
                        {etape === 'upload'
                            ? 'Téléchargez votre CV en PDF — l\'IA extrait automatiquement toutes vos informations.'
                            : 'Vérifiez les données extraites avant de générer votre nouveau CV.'}
                    </p>
                </div>

                <div className="imp-content">

                    {/* ══ VUE UPLOAD : zone de dépôt ou spinner ══ */}
                    {etape === 'upload' && (
                        loading ? (
                            /* Spinner pendant l'analyse du CV */
                            <div className="imp-spinner-wrap">
                                <div className="imp-spinner" />
                                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
                                    Analyse du CV en cours…
                                </p>
                            </div>
                        ) : (
                            /* Zone de dépôt : clic ou drag & drop */
                            <div
                                className={`imp-dropzone${dragOver ? ' drag-over' : ''}`}
                                onClick={() => inputRef.current.click()} // Ouvre le sélecteur de fichier
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }} // Autorise le drop
                                onDragLeave={() => setDragOver(false)} // Fin du survol
                                onDrop={handleDrop} // Traite le fichier déposé
                            >
                                {/* Input file caché (déclenché par le clic sur la zone) */}
                                <input
                                    ref={inputRef} type="file" accept=".pdf"
                                    style={{ display: 'none' }}
                                    onChange={e => handleFichier(e.target.files[0])}
                                />
                                {/* Icône upload dans un carré arrondi */}
                                <div className="imp-drop-icon">
                                    <Icon d={ICONS.upload} size={24} />
                                </div>
                                <p className="imp-drop-title">Déposez votre CV ici</p>
                                <p className="imp-drop-sub">ou cliquez pour sélectionner un fichier</p>
                                <span className="imp-badge">PDF uniquement</span>
                            </div>
                        )
                    )}

                    {/* ══ VUE RÉSULTATS : données extraites du CV ══ */}
                    {etape === 'resultats' && profil && (
                        <>
                            {/* Bannière de succès */}
                            <div className="imp-success">
                                <div className="imp-success-icon">
                                    <Icon d={ICONS.check} size={16} color="#fff" />
                                </div>
                                <div>
                                    <p className="imp-success-title">CV analysé avec succès</p>
                                    <p className="imp-success-sub">
                                        Vérifiez et corrigez les informations ci-dessous, puis continuez.
                                    </p>
                                </div>
                            </div>

                            {/* Section : Informations personnelles */}
                            <div className="imp-card">
                                <p className="imp-section-title">
                                    <Icon d={ICONS.user} size={14} />
                                    Informations personnelles
                                </p>
                                {/* Grille de 6 champs : prénom, nom, email, téléphone, ville, LinkedIn */}
                                <div className="imp-info-grid">
                                    {[
                                        ['Prénom',    profil.prenom],
                                        ['Nom',       profil.nom],
                                        ['Email',     profil.email],
                                        ['Téléphone', profil.telephone],
                                        ['Ville',     profil.ville],
                                        ['LinkedIn',  profil.linkedin],
                                    ].map(([label, val]) => (
                                        <div key={label} className="imp-info-cell">
                                            <p className="imp-cell-label">{label}</p>
                                            <p className="imp-cell-value">{val || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section : Expériences professionnelles */}
                            <div className="imp-card">
                                <p className="imp-section-title">
                                    <Icon d={ICONS.briefcase} size={14} />
                                    Expériences
                                </p>
                                {/* Parcourt chaque expérience extraite */}
                                {profil.experiences?.map((exp, i) => (
                                    <div key={i} className="imp-exp-item">
                                        <p className="imp-exp-title">{exp.titre}</p>
                                        <p className="imp-exp-company">
                                            {exp.entreprise}
                                            {exp.duree ? ` · ${exp.duree}` : ''}
                                            {exp.lieu  ? ` · ${exp.lieu}`  : ''}
                                        </p>
                                        {/* Description : joint le tableau si c'est un array */}
                                        {exp.description?.length > 0 && (
                                            <p className="imp-exp-desc">
                                                {Array.isArray(exp.description)
                                                    ? exp.description.join(' ')
                                                    : exp.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Section : Compétences (affichées en pilules) */}
                            <div className="imp-card">
                                <p className="imp-section-title">
                                    <Icon d={ICONS.tool} size={14} />
                                    Compétences
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {/* Aplati les catégories et affiche chaque compétence */}
                                    {/* >>> .flatMap() = combine .map() + aplatissement en une étape.
                                            profil.competences est [{categorie, elements:[...]}], on veut
                                            juste une liste plate de toutes les compétences. "?? [cat]"
                                            = filet de sécurité si jamais une entrée n'a pas d'elements. */}
                                    {profil.competences?.flatMap(cat => cat.elements ?? [cat]).map((c, i) => (
                                        <span key={i} className="imp-pill">
                                            {typeof c === 'string' ? c : c.nom ?? c}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Section : Formations */}
                            <div className="imp-card">
                                <p className="imp-section-title">
                                    <Icon d={ICONS.book} size={14} />
                                    Formation
                                </p>
                                {/* Parcourt chaque formation extraite */}
                                {profil.formations?.map((f, i) => (
                                    <div key={i} className="imp-exp-item">
                                        <p className="imp-exp-title">{f.diplome}</p>
                                        <p className="imp-exp-company">
                                            {f.etablissement}
                                            {f.annee ? ` · ${f.annee}` : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Boutons d'action : réimporter ou continuer */}
                            <div className="imp-actions">
                                {/* Bouton réimporter : revient à l'étape upload */}
                                <button className="imp-btn-secondary"
                                    onClick={() => { setEtape('upload'); setProfil(null); }}>
                                    <Icon d={ICONS.refresh} size={14} color="currentColor" />
                                    Réimporter
                                </button>
                                {/* Bouton continuer : redirige vers la génération */}
                                <button className="imp-btn-primary" onClick={() => navigate('/nouveau-cv')}>
                                    Générer mon CV
                                    <Icon d={ICONS.arrow} size={15} color="#fff" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

// Export par défaut du composant Page_import_cv
export default Page_import_cv;