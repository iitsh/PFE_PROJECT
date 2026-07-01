// Import des hooks React : useState, useRef, useEffect, useCallback, memo, forwardRef
import { useState, useRef, useEffect, useCallback, memo, forwardRef } from 'react';
// Import du hook de navigation React Router
import { useNavigate } from 'react-router-dom';
// Import du composant Navbar (barre de navigation)
import Navbar from './Navbar';
// Import du thème centralisé (couleurs, tokens de design)
import { theme } from '../theme';

// ── Utilitaires : fonctions de nettoyage et parsing des données ─────────────
// Regex pour détecter les niveaux de langue (A1-C2, Natif, Courant, etc.)
const NIVEAUX_REGEX = /\b(A1|A2|B1|B2|C1|C2|Natif|Courant|Avancé|Intermédiaire|Débutant|Élémentaire|Maternel|Bilingue|Lu[,]? [é]crit[,]? [p]arlé)\b/i;

// ── Nettoie un numéro de téléphone (gère les préfixes internationaux) ──────
// Convertit +33/33 en 0, garde uniquement les 10 derniers chiffres
// >>> Mesure défensive contre l'IA : le LLM peut renvoyer "+33612345678"
//     au lieu du format français attendu "0612345678" — cette fonction
//     normalise systématiquement le format avant affichage.
const cleanPhone = (phone) => {
    if (!phone) return ''; // Retourne vide si pas de téléphone
    // Supprime les caractères non numériques sauf +, remplace les préfixes FR/MA
    let c = phone.replace(/[^\d+]/g, '').replace(/^\+33/, '0').replace(/^\+212/, '0').replace(/^33/, '0');
    const d = c.replace(/\D/g, ''); // Extrait uniquement les chiffres
    return d.length >= 10 ? '0' + d.slice(-9) : c; // Formate en 10 chiffres français
};

// ── Nettoie un élément de compétence (supprime URLs, parenthèses, etc.) ───
// Retourne une chaîne vide si l'élément est invalide ou trop court
const cleanCompetenceElement = (el) => {
    if (!el || typeof el !== 'string') return ''; // Ignore les non-strings
    let c = el.trim()
        .replace(/\(?https?:\/\/\S+\)?/g, '') // Supprime les URLs
        .replace(/^[)\]]+\s*/g, '').replace(/\s*[(\[]+$/g, '') // Supprime parenthèses en début/fin
        .replace(/[()[\]]/g, '') // Supprime toutes les parenthèses restantes
        .replace(/^[\s,;:.!?\-–—]+/g, '').replace(/[\s,;:.!?\-–—]+$/g, '') // Supprime ponctuation
        .trim();
    // Filtre : trop court, uniquement chiffres, ou uniquement symboles
    if (c.length <= 1 || /^\d+$/.test(c) || /^[()[\]{}<>]+$/.test(c)) return '';
    return c; // Retourne la compétence nettoyée
};

// ── Nettoie un tableau de compétences (nettoie chaque élément et filtre) ──
// Parcourt chaque catégorie, nettoie ses éléments, supprime les vides
const cleanCompetences = (competences) =>
    (competences || [])
        .map(cat => ({ ...cat, elements: (cat.elements || []).map(cleanCompetenceElement).filter(Boolean) }))
        .filter(cat => cat.elements.length > 0); // Supprime les catégories vides

// ── Parse une chaîne de langue en objet { nom, niveau } ──────────────────
// Ex: "Anglais (C1)" → { nom: "Anglais", niveau: "C1" }
const parseLangue = (str) => {
    // Supprime les parenthèses et nettoie les espaces
    const cleaned = str.replace(/[()]/g, '').trim();
    // Cherche un niveau standard (A1-C2, Natif, etc.) via regex
    const match = cleaned.match(NIVEAUX_REGEX);
    if (match) {
        // Extrait le nom avant le niveau détecté
        const nom = cleaned.substring(0, match.index).replace(/[-–—:,\s]+$/, '').trim();
        return { nom: nom || cleaned, niveau: match[0].trim() };
    }
    // Fallback : essaie de séparer par des tirets ou deux-points
    for (const sep of [' — ', ' - ', ' – ', ' : ']) {
        const parts = cleaned.split(sep);
        if (parts.length === 2 && parts[1].trim()) return { nom: parts[0].trim(), niveau: parts[1].trim() };
    }
    // Aucun niveau détecté : retourne le nom complet sans niveau
    return { nom: cleaned, niveau: '' };
};

// ── Icône SVG réutilisable : affiche un path SVG avec taille et couleur ───
// Composant générique pour toutes les icônes de cette page
const Icon = ({ d, size = 16, color = theme.accent }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

// ── Dictionnaire des icônes SVG utilisées dans le générateur de CV ───────
const ICONS = {
    upload:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    user:     'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    brief:    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    book:     'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    tool:     'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    folder:   'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    globe:    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    spark:    'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    check:    'M20 6L9 17l-5-5',
    plus:     'M12 5v14 M5 12h14',
    x:        'M18 6L6 18M6 6l12 12',
    arrow:    'M5 12h14 M12 5l7 7-7 7',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    refresh:  'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
    save:     'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
    file:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
    skip:     'M5 4l10 8-10 8V4z M19 5v14',
};

// ── Composants réutilisables : Card, SectionTitle, champs, boutons ─────────
// Carte avec fond, bordure arrondie (memo pour perf, forwardRef pour ref)
const Card = memo(forwardRef(({ children, style = {} }, ref) => (
    <div ref={ref} style={{
        background: theme.surface, border: `1.5px solid ${theme.border}`,
        borderRadius: 12, padding: 24, marginBottom: 16, ...style,
    }}>{children}</div>
)));

// Titre de section avec icône et label en majuscules
const SectionTitle = ({ icon, label }) => (
    <p style={{
        fontSize: 13, fontWeight: 700, color: theme.text,
        margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
        textTransform: 'uppercase', letterSpacing: '.05em',
    }}>
        <Icon d={ICONS[icon]} size={14} color={theme.accent} /> {/* Icône de la section */}
        {label} {/* Texte du titre */}
    </p>
);

// Champ de saisie avec label optionnel, effets focus/blur
const FieldInput = memo(({ label, value, onChange, type = 'text', placeholder = '' }) => (
    <div style={{ marginBottom: 12 }}>
        {label && <label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 5 }}>{label}</label>}
        {/* Input avec styles inline et gestion du focus */}
        <input type={type} placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)}
            style={{
                background: theme.surfaceAlt, border: `1.5px solid ${theme.border}`, borderRadius: 8,
                padding: '9px 13px', fontSize: 13.5, color: theme.text, outline: 'none',
                width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
                transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = theme.accent; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = theme.border; e.target.style.boxShadow = 'none'; }}
        />
    </div>
));

// Zone de texte multiligne avec label optionnel
const FieldTextarea = memo(({ label, value, onChange, rows = 3, placeholder = '' }) => (
    <div style={{ marginBottom: 12 }}>
        {label && <label style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 5 }}>{label}</label>}
        {/* Textarea redimensionnable verticalement */}
        <textarea rows={rows} placeholder={placeholder} value={value || ''} onChange={e => onChange(e.target.value)}
            style={{
                background: theme.surfaceAlt, border: `1.5px solid ${theme.border}`, borderRadius: 8,
                padding: '9px 13px', fontSize: 13.5, color: theme.text, outline: 'none',
                width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = theme.accent; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = theme.border; e.target.style.boxShadow = 'none'; }}
        />
    </div>
));

// Spinner de chargement avec message
const Spinner = ({ msg }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '56px 0' }}>
        {/* Cercle qui tourne avec bordure accentuée en haut */}
        <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid ${theme.border}`, borderTopColor: theme.accent,
            animation: 'ncvSpin .8s linear infinite',
        }} />
        <p style={{ color: theme.textSecondary, margin: 0, fontSize: 14 }}>{msg}</p>
    </div>
);

// Sous-carte pour les éléments individuels (expérience, formation, etc.)
const SubCard = ({ children }) => (
    <div style={{
        background: theme.surfaceAlt, border: `1px solid ${theme.border}`,
        borderRadius: 8, padding: '14px 16px', marginBottom: 10, position: 'relative',
    }}>{children}</div>
);

// Bouton de suppression (×) en haut à droite d'une sous-carte
const RemoveBtn = ({ onClick }) => (
    <button onClick={onClick} style={{
        position: 'absolute', top: 10, right: 12,
        background: 'none', border: 'none', cursor: 'pointer',
        color: theme.textMuted, padding: 2, display: 'flex', alignItems: 'center',
        borderRadius: 4, transition: 'color 0.13s',
    }}
        onMouseEnter={e => e.currentTarget.style.color = theme.error} // Rouge au hover
        onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}>
        <Icon d={ICONS.x} size={14} color="currentColor" />
    </button>
);

// Bouton "Ajouter" avec bordure pointillée et icône +
const AddBtn = ({ label, onClick }) => (
    <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        /* ✅ FIX: border plus visible — #94A3B8 au lieu de var(--border) */
        background: 'transparent', border: '1.5px dashed #94A3B8',
        borderRadius: 8, padding: '8px 16px',
        fontSize: 13, fontWeight: 600, color: '#64748B',
        cursor: 'pointer', fontFamily: 'inherit', width: '100%',
        justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s, background 0.15s',
    }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.accent; e.currentTarget.style.background = theme.accentMuted; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent'; }}>
        <Icon d={ICONS.plus} size={13} color="currentColor" />
        {label}
    </button>
);

// ── Stepper : indicateur visuel des 4 étapes du processus ──────────────────
// Les 4 étapes : Import CV → Modifier profil → Offre d'emploi → CV généré
const STEPS = ['Import CV', 'Modifier profil', "Offre d'emploi", 'CV généré'];

const Stepper = ({ step }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {STEPS.map((label, i) => {
            const num = i + 1, active = step === num, done = step > num;
            return (
                <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Cercle */}
                        <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700,
                            // ✅ Inactif : fond transparent + bordure bien visible #64748B
                            background: done ? theme.success : active ? theme.accent : 'transparent',
                            border: done || active ? 'none' : '2px solid #64748B',
                            color: done || active ? '#fff' : '#64748B',
                            transition: 'background 0.2s, border-color 0.2s',
                        }}>
                            {done ? <Icon d={ICONS.check} size={13} color="#fff" /> : num}
                        </div>
                        {/* Label */}
                        <span style={{
                            fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                            // ✅ Label inactif : #64748B lisible en dark ET light
                            color: done ? theme.success : active ? '#fff' : '#64748B',
                        }}>{label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                        // ✅ Ligne de connexion : #64748B au lieu de var(--border) qui était blanc sur fond sombre
                        <div style={{
                            flex: 1, height: 2, margin: '0 10px',
                            background: done ? theme.success : '#64748B',
                            opacity: done ? 1 : 0.4,
                            transition: 'background 0.3s',
                        }} />
                    )}
                </div>
            );
        })}
    </div>
);

// ══ Page Nouveau CV : générateur complet en 4 étapes ════════════════════════
// Composant principal qui gère tout le flux : import → édition → analyse → génération
// >>> C'EST LE FICHIER FRONTEND LE PLUS IMPORTANT — il orchestre les 4 appels
//     backend du pipeline complet : /parse (import) → /profil PUT (sauvegarde)
//     → /analyze-offer (analyse) → /generate (génération finale). Chaque
//     fonction correspond à UNE étape du Stepper visuel (STEPS ci-dessus).
export const Page_nouveau_cv = ({ accessToken, setAccessToken }) => {
    const navigate = useNavigate(); // Hook de navigation pour les redirections
    const inputRef = useRef(); // Référence vers l'input file caché

    // ── États locaux du composant ──────────────────────────────────────────────
    const [step,        setStep]       = useState(1); // Étape actuelle du stepper (1 à 4)
    const [loading,     setLoading]    = useState(false); // Chargement pour import/analyse
    const [loadingGen,  setLoadingGen] = useState(false); // Chargement spécifique à la génération
    const [dragOver,    setDragOver]   = useState(false); // Survol drag & drop
    const [texteOffre,  setTexteOffre] = useState(''); // Texte de l'offre d'emploi collée
    const [analyse,     setAnalyse]    = useState(null); // Résultat de l'analyse IA de l'offre
    const [htmlCv,      setHtmlCv]     = useState(null); // HTML du CV généré
    const [htmlLettre,  setHtmlLettre] = useState(null); // HTML de la lettre de motivation
    const [showLettre,  setShowLettre] = useState(false); // Affiche la lettre ou le CV
    const [toast,       setToast]      = useState(''); // Message toast temporaire
    const analyseRef  = useRef(null); // Ref pour scroller vers le résultat d'analyse
    const generateRef = useRef(null); // Ref pour scroller vers la zone de génération

    // État du profil utilisateur : données personnelles + expériences + formations + etc.
    const [profil, setProfil] = useState({
        prenom: '', nom: '', email: '', telephone: '', ville: '',
        linkedin: '', github: '', portfolio: '', resume: '',
        experiences: [], formations: [], competences: [], projets: [], langues: [],
    });

    // Affiche un message toast pendant 2.5 secondes puis le masque
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };



    useEffect(() => { if (analyse) setTimeout(() => analyseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }, [analyse]);
    // >>> Ces 2 useEffect font défiler automatiquement la page vers le
    //     résultat d'analyse ou la zone de génération dès qu'ils apparaissent
    //     — UX : évite que l'utilisateur doive scroller manuellement pour
    //     voir le résultat de son action.
    useEffect(() => { if (loadingGen && generateRef.current) setTimeout(() => generateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }, [loadingGen]);

    // ── Helpers : fonctions utilitaires pour mettre à jour l'état du profil ───
    // >>> useCallback(fn, []) = MÉMOÏSE la fonction — React garde la MÊME
    //     référence de fonction entre les rendus (tant que les dépendances
    //     ne changent pas). Utile ici car ces fonctions sont passées en
    //     props à des composants "memo" (Card, FieldInput...) plus bas —
    //     sans useCallback, une nouvelle fonction serait créée à chaque
    //     rendu, cassant l'optimisation memo().
    // Met à jour un champ simple du profil (ex: prenom, nom, email...)
    // >>> setProfil(p => ({ ...p, [f]: v })) = pattern IMMUABLE : on ne
    //     modifie jamais l'état directement, on crée un NOUVEL objet qui
    //     copie tous les champs existants (...p) et écrase juste le champ
    //     [f] — obligatoire pour que React détecte le changement et re-rende.
    const updateField       = useCallback((f, v) => setProfil(p => ({ ...p, [f]: v })), []);
    // Met à jour un champ d'un élément dans un tableau (ex: titre d'une expérience)
    const updateArrayItem   = useCallback((arr, idx, f, v) => setProfil(p => { const a = [...p[arr]]; a[idx] = { ...a[idx], [f]: v }; return { ...p, [arr]: a }; }), []);
    // Ajoute un nouvel élément dans un tableau (ex: nouvelle expérience)
    const addArrayItem      = useCallback((arr, tpl) => setProfil(p => ({ ...p, [arr]: [...p[arr], { ...tpl }] })), []);
    // Supprime un élément d'un tableau par son index
    const removeArrayItem   = useCallback((arr, idx) => setProfil(p => ({ ...p, [arr]: p[arr].filter((_, i) => i !== idx) })), []);
    // Ajoute un élément vide dans une catégorie de compétences
    const addCompEl         = useCallback((ci) => setProfil(p => { const c = [...p.competences]; c[ci] = { ...c[ci], elements: [...(c[ci].elements || []), ''] }; return { ...p, competences: c }; }), []);
    // Met à jour la valeur d'un élément de compétence spécifique
    const updateCompEl      = useCallback((ci, ei, v) => setProfil(p => { const c = [...p.competences]; const e = [...c[ci].elements]; e[ei] = v; c[ci] = { ...c[ci], elements: e }; return { ...p, competences: c }; }), []);
    // Supprime un élément de compétence par ses indices catégorie/élément
    const removeCompEl      = useCallback((ci, ei) => setProfil(p => { const c = [...p.competences]; c[ci] = { ...c[ci], elements: c[ci].elements.filter((_, i) => i !== ei) }; return { ...p, competences: c }; }), []);

    // ── Step 1 : Import — envoie le PDF au backend pour extraction ─────────
    // Gère l'upload d'un fichier PDF : l'envoie au serveur, reçoit les données extraites
    // >>> Contrairement à Page_import_cv.jsx, ici le résultat va DIRECTEMENT
    //     remplir l'état "profil" du composant (pas sessionStorage) — c'est
    //     le flux principal et autonome de génération complète en 4 étapes.
    const handleFichier = async (file) => {
        // Vérifie que le fichier existe et est bien un PDF
        if (!file || file.type !== 'application/pdf') return;
        setLoading(true); // Active le spinner de chargement
        const fd = new FormData(); fd.append('file', file); // Crée le FormData avec le fichier
        try {
            // Envoie le PDF au endpoint de parsing
            const res = await fetch('http://localhost:8000/api/cv/parse', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: fd });
            // Si erreur HTTP, extrait le message et lance une exception
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Erreur (${res.status})`); }
            const data = await res.json(); // Parse la réponse JSON avec les données extraites
            // Nettoie les langues reçues (string → objet {nom, niveau})
            const langues = (data.langues || []).map(l => typeof l === 'string' ? parseLangue(l) : l);
            // Remplit le profil avec les données extraites du CV
            setProfil({ prenom: data.prenom||'', nom: data.nom||'', email: data.email||'', telephone: cleanPhone(data.telephone), ville: data.ville||'', linkedin: data.linkedin||'', github: data.github||'', portfolio: data.portfolio||'', resume: data.resume||'', experiences: data.experiences||[], formations: data.formations||[], competences: cleanCompetences(data.competences), projets: data.projets||[], langues });
            setStep(2); // Passe à l'étape d'édition du profil
        } catch (err) { console.error(err); alert(err.message); } // Affiche l'erreur à l'utilisateur
        finally { setLoading(false); } // Désactive le spinner dans tous les cas
    };

    // ── Step 3 : Analyse l'offre d'emploi via l'IA ──────────────────────────
    // Envoie le texte de l'offre au backend pour extraction des compétences/niveau
    const analyserOffre = async () => {
        if (!texteOffre.trim()) return; // Ne pas envoyer si le champ est vide
        setLoading(true); // Active le spinner
        try {
            // Appelle le endpoint d'analyse avec le texte de l'offre
            const res = await fetch('http://localhost:8000/api/cv/analyze-offer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ texteOffre }) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.detail); } // Erreur HTTP
            setAnalyse(await res.json()); // Stocke le résultat d'analyse (titre, compétences, etc.)
        } catch (err) { alert(err.message); } // Affiche l'erreur
        finally { setLoading(false); } // Désactive le spinner
    };

    // ── Step 3 → 4 : Génère le CV et la lettre de motivation via l'IA ──────
    // Combine le profil + l'analyse de l'offre pour générer un CV personnalisé
    const genererCV = async () => {
        setLoadingGen(true); // Active le spinner de génération
        try {
            // Formate les langues en string pour l'envoi (objet → "Nom — Niveau")
            const profilToSend = { ...profil, langues: profil.langues.map(l => typeof l === 'string' ? l : `${l.nom}${l.niveau ? ' — ' + l.niveau : ''}`) };
            const body = { analyseOffre: analyse }; // Corps de la requête avec l'analyse
            // N'envoie le profil que s'il contient des données
            if (profil.prenom || profil.nom || (profil.experiences || []).length > 0) body.profil = profilToSend;
            // Appelle le endpoint de génération de CV
            const res = await fetch('http://localhost:8000/api/cv/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.detail); } // Erreur HTTP
            const data = await res.json(); // Parse la réponse avec les HTML générés
            // Stocke les HTML et passe à l'étape 4 (affichage du CV)
            setHtmlCv(data.html_cv); setHtmlLettre(data.html_lettre); setStep(4); setTexteOffre(''); setAnalyse(null); setShowLettre(false);
        } catch (err) { alert(err.message); } // Affiche l'erreur
        finally { setLoadingGen(false); } // Désactive le spinner
    };

    // ── Valide le profil : sauvegarde en BDD puis passe à l'étape suivante ──
    // Combine la sauvegarde et la navigation en une seule action
    // >>> C'EST LE BOUTON "Enregistrer le profil" — il appelle PUT /api/cv/
    //     profil (voir routes/cv.py), qui fait le DELETE+INSERT en BDD.
    //     Distinct de "Valider le profil" (qui, lui, avance juste à step 3
    //     sans forcément sauvegarder — vu dans le rendu JSX plus bas).
    const validerProfil = async () => {
        setLoading(true); // Active le spinner
        try {
            // Formate les langues en string pour l'envoi
            const profilToSave = { ...profil, langues: profil.langues.map(l => typeof l === 'string' ? l : `${l.nom}${l.niveau ? ' — ' + l.niveau : ''}`) };
            // Envoie le profil au serveur pour le sauvegarder en BDD
            const res = await fetch('http://localhost:8000/api/cv/profil', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(profilToSave) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.detail); } // Erreur HTTP
            showToast('Profil enregistré'); // Affiche un toast de confirmation
            setStep(3); // Passe à l'étape d'analyse de l'offre
        } catch (err) { alert(err.message); } // Affiche l'erreur
        finally { setLoading(false); } // Désactive le spinner
    };

    // ── Télécharge le CV ou la lettre de motivation en PDF via impression ──
    // Crée un iframe caché, y injecte le HTML, et lance la boîte de dialogue d'impression
    // >>> ASTUCE TECHNIQUE : pas de vrai téléchargement PDF ici — on utilise
    //     la fonction NATIVE d'impression du navigateur (window.print()) sur
    //     un iframe invisible contenant le HTML du CV. L'utilisateur choisit
    //     "Enregistrer en PDF" comme imprimante dans la boîte de dialogue
    //     système. C'est différent du PDF généré côté SERVEUR par Playwright
    //     (cv_pipeline.py) — ici c'est le NAVIGATEUR qui imprime le HTML reçu.
    const telecharger = () => {
        const activeHtml = showLettre ? htmlLettre : htmlCv; // Sélectionne le HTML actif
        if (!activeHtml) return; // Ne fait rien si pas de contenu
        // Détermine le nom de fichier selon le type de document
        const nomFichier = showLettre
            ? `Lettre de Motivation - ${profil.prenom || ''} ${profil.nom || ''}`.trim()
            : `CV - ${profil.prenom || ''} ${profil.nom || ''}`.trim();
        // Modifie temporairement le titre de la page pour que le navigateur propose ce nom
        const titreOriginal = document.title;
        document.title = nomFichier;
        const iframe = document.createElement('iframe'); // Crée un iframe caché
        iframe.style.display = 'none'; document.body.appendChild(iframe); // L'ajoute au DOM
        // Ouvre le document de l'iframe et y écrit le HTML du CV/lettre
        iframe.contentWindow.document.open(); iframe.contentWindow.document.write(activeHtml); iframe.contentWindow.document.close();
        // Attend un court délai pour que le navigateur prenne en compte le nouveau titre
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            // Supprime l'iframe et restaure le titre original après impression
            setTimeout(() => {
                document.body.removeChild(iframe);
                document.title = titreOriginal;
            }, 2000);
        }, 100);
    };

    return (
        <>
            {/* ── Styles CSS intégrés pour cette page (animations, layout, composants) ── */}
            <style>{`
                /* ── Animation de rotation pour le spinner de chargement ── */
                @keyframes ncvSpin { to { transform: rotate(360deg); } }

                /* ── Layout principal : racine, en-tête, contenu ── */
                .ncv-root    { min-height: 100vh; background: var(--bg-alt); } /* Conteneur pleine hauteur */
                .ncv-header  { max-width: 1000px; margin: 0 auto; padding: 36px 32px 0; } /* En-tête centré */
                .ncv-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); margin: 0 0 10px; display: flex; align-items: center; gap: 6px; } /* Sur-titre en majuscules */
                .ncv-h1      { font-size: 1.75rem; font-weight: 800; color: var(--text); margin: 0 0 5px; letter-spacing: -0.02em; } /* Titre principal */
                .ncv-sub     { font-size: 14px; color: var(--text-secondary); margin: 0 0 28px; } /* Sous-titre descriptif */
                .ncv-content { max-width: 1000px; margin: 0 auto; padding: 24px 32px 64px; } /* Zone de contenu centrée */

                /* ── Zone de dépôt de fichier (drag & drop) ── */
                .ncv-dropzone { background: var(--bg); border: 2px dashed var(--border); border-radius: 14px; padding: 72px 32px; display: flex; flex-direction: column; align-items: center; gap: 16px; cursor: pointer; text-align: center; transition: border-color 0.15s, background 0.15s; } /* Zone pointillée avec effet hover */
                .ncv-dropzone:hover, .ncv-dropzone.over { border-color: var(--accent); background: var(--accent-muted); } /* Survol ou drag au-dessus */
                .ncv-drop-icon  { width: 52px; height: 52px; border-radius: 12px; background: var(--accent-muted); display: flex; align-items: center; justify-content: center; } /* Icône d'upload ronde */
                .ncv-drop-title { font-size: 1.05rem; font-weight: 700; color: var(--text); margin: 0; } /* Titre "Déposez votre CV" */
                .ncv-drop-sub   { font-size: 13.5px; color: var(--text-secondary); margin: 0; } /* Sous-texte "ou cliquez" */
                .ncv-badge      { font-size: 11px; font-weight: 700; background: var(--bg-alt); border: 1.5px solid var(--border); border-radius: 6px; padding: 4px 10px; color: var(--text-secondary); letter-spacing: .04em; } /* Badge "PDF uniquement" */

                
                /* ── En-tête de section avec titre + bouton Ajouter ── */
                .ncv-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; } /* Espacement titre/bouton */

                /* ✅ FIX image 2&3 : bouton "Ajouter" header — border #64748B bien visible */
                .ncv-add-header-btn {
                    display: flex; align-items: center; gap: 6px;
                    background: transparent;
                    color: #475569;
                    /* Bordure sombre et lisible */
                    border: 1.5px solid #64748B;
                    border-radius: 9999px;
                    padding: 7px 16px; font-size: 12.5px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: background 0.13s, border-color 0.13s, color 0.13s;
                }
                .ncv-add-header-btn:hover {
                    background: var(--accent-muted);
                    border-color: var(--accent);
                    color: var(--accent);
                }

                /* ── Chips de compétences : pastilles éditables avec bouton × ── */
                .ncv-comp-chip {
                    display: inline-flex; align-items: center; gap: 4px;
                    border: 1.5px solid #64748B;
                    border-radius: 9999px; padding: 4px 10px;
                    background: var(--bg);
                }
                .ncv-comp-input  { width: 110px; font-size: 12px; background: none; border: none; outline: none; color: var(--text); font-family: inherit; } /* Input inline dans le chip */
                .ncv-comp-add    { display: inline-flex; align-items: center; gap: 5px; background: var(--accent-muted); color: var(--accent); border: 1.5px solid var(--accent-light); border-radius: 9999px; padding: 5px 13px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.13s; } /* Bouton + élément */
                .ncv-comp-add:hover { background: var(--accent-light); } /* Hover du bouton ajouter */
                .ncv-comp-remove { background: none; border: none; cursor: pointer; color: #94A3B8; display: flex; align-items: center; padding: 0; transition: color 0.13s; } /* Bouton × dans le chip */
                .ncv-comp-remove:hover { color: var(--error); } /* Rouge au hover */

                /* ── Badges de compétences dans le résultat d'analyse ── */
                .ncv-skill-req { background: var(--error-light); color: var(--error); border: 1px solid rgba(220,38,38,0.25); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-block; } /* Compétence requise (rouge) */
                .ncv-skill-opt { background: #FFFBEB; color: #92400E; border: 1px solid rgba(217,119,6,0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; display: inline-block; } /* Compétence souhaitée (ambre) */

                /* ── Cellules d'information dans le résultat d'analyse ── */
                .ncv-info-cell    { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; } /* Carte info avec bordure */
                .ncv-cell-label   { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin: 0 0 4px; } /* Label au-dessus de la valeur */
                .ncv-cell-value   { font-size: 13.5px; font-weight: 600; color: var(--text); margin: 0; } /* Valeur affichée */

                /* ── Boutons d'action : primaire, secondaire, sauvegarder, générer ── */
                /* Bouton primaire (fond accent, texte blanc) */
                .ncv-btn-primary {
                    display: flex; align-items: center; gap: 7px;
                    background: var(--accent); color: #fff;
                    border: none; border-radius: 9999px;
                    padding: 11px 24px; font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: background 0.15s;
                }
                .ncv-btn-primary:hover { background: var(--accent-hover); } /* Hover : accent plus foncé */

                /* Bouton secondaire (fond transparent, bordure visible) */
                .ncv-btn-secondary {
                    display: flex; align-items: center; gap: 7px;
                    background: var(--bg);
                    color: var(--accent);
                    border: 1.5px solid #64748B;
                    border-radius: 9999px;
                    padding: 11px 22px; font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: border-color 0.15s, color 0.15s, background 0.15s;
                }
                .ncv-btn-secondary:hover {
                    border-color: var(--accent);
                    color: var(--accent);
                    background: var(--accent-muted);
                }


                /* Bouton de génération (fond vert plein, texte blanc) */
                .ncv-btn-gen {
                    display: flex; align-items: center; gap: 7px;
                    background: #16A34A; color: #fff;
                    border: none; border-radius: 9999px;
                    padding: 11px 24px; font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: background 0.15s;
                }
                .ncv-btn-gen:hover { background: #15803D; } /* Hover : vert plus foncé */

                /* ── Toast : notification temporaire en haut à droite ── */
                .ncv-toast { position: fixed; top: 20px; right: 20px; z-index: 999; background: #16A34A; color: #fff; border-radius: 10px; padding: 13px 22px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.15); animation: ncvFadeIn 0.2s ease; } /* Toast vert de confirmation */
                @keyframes ncvFadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } } /* Animation d'apparition du toast */

                /* ── Grilles responsive et conteneur d'actions ── */
                .ncv-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } /* Grille 3 colonnes */
                .ncv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } /* Grille 2 colonnes */
                .ncv-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; } /* Grille 4 colonnes */
                .ncv-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; } /* Conteneur de boutons centré */

                /* ── Responsive : tablette et mobile (< 768px) ── */
                @media (max-width: 768px) {
                    .ncv-header, .ncv-content { padding-left: 20px; padding-right: 20px; }
                    .ncv-grid-3, .ncv-grid-2  { grid-template-columns: 1fr; }
                    .ncv-grid-4               { grid-template-columns: 1fr 1fr; }
                    .ncv-actions              { flex-direction: column; align-items: stretch; }
                }
            `}</style>

            {/* Affiche le toast de confirmation si un message est présent */}
            {toast && <div className="ncv-toast">{toast}</div>}

            {/* ── Conteneur principal de la page ── */}
            <div className="ncv-root">
                {/* Barre de navigation avec statut connecté */}
                <Navbar connected accessToken={accessToken} setAccessToken={setAccessToken} />

                {/* ── En-tête de la page avec titre et description ── */}
                <div className="ncv-header">
                    <p className="ncv-eyebrow"><Icon d={ICONS.file} size={13} />Nouveau CV</p> {/* Sur-titre avec icône */}
                    <h1 className="ncv-h1">Créer un nouveau CV</h1> {/* Titre principal */}
                    <p className="ncv-sub">Importez votre CV, vérifiez les données, collez une offre — l'IA génère le reste.</p> {/* Description */}
                </div>

                {/* ── Zone de contenu avec le stepper et les étapes ── */}
                <div className="ncv-content">
                    <Stepper step={step} /> {/* Indicateur visuel de l'étape actuelle */}

                    {/* ══ STEP 1 : Import CV — zone de drag & drop + option skip ══ */}
                    {step === 1 && (loading ? <Spinner msg="Analyse du CV en cours…" /> : ( /* Spinner ou zone de dépôt */
                        <>
                            <div className={`ncv-dropzone${dragOver ? ' over' : ''}`}
                                onClick={() => inputRef.current.click()}
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => { e.preventDefault(); setDragOver(false); handleFichier(e.dataTransfer.files[0]); }}>
                                <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
                                    onChange={e => handleFichier(e.target.files[0])} />
                                <div className="ncv-drop-icon"><Icon d={ICONS.upload} size={24} /></div>
                                <p className="ncv-drop-title">Déposez votre CV ici</p>
                                <p className="ncv-drop-sub">ou cliquez pour sélectionner un fichier</p>
                                <span className="ncv-badge">PDF uniquement</span>
                            </div>


                        </>
                    ))}

                    {/* ══ STEP 2 : Édition du profil — formulaires pour chaque section ══ */}
                    {step === 2 && (
                        <>
                            {/* Informations personnelles */}
                            <Card>
                                <SectionTitle icon="user" label="Informations personnelles" />
                                <div className="ncv-grid-3">
                                    {[['Prénom','prenom'],['Nom','nom'],['Email','email'],['Téléphone','telephone'],['Ville','ville'],['LinkedIn','linkedin'],['GitHub','github'],['Portfolio','portfolio']].map(([lbl, key]) => (
                                        <FieldInput key={key} label={lbl} value={profil[key]} onChange={v => updateField(key, v)} />
                                    ))}
                                </div>
                                <FieldTextarea label="Résumé professionnel" value={profil.resume} onChange={v => updateField('resume', v)} rows={3} placeholder="Décrivez brièvement votre profil…" />
                            </Card>

                            {/* Expériences */}
                            <Card>
                                <div className="ncv-section-header">
                                    <SectionTitle icon="brief" label="Expériences" />
                                    {/* ✅ FIX image 2 : bouton Ajouter avec classe visible */}
                                    <button className="ncv-add-header-btn"
                                        onClick={() => addArrayItem('experiences', { titre:'',entreprise:'',duree:'',lieu:'',description:[] })}>
                                        <Icon d={ICONS.plus} size={12} color="currentColor" /> Ajouter
                                    </button>
                                </div>
                                {profil.experiences.map((exp, i) => (
                                    <SubCard key={i}>
                                        <RemoveBtn onClick={() => removeArrayItem('experiences', i)} />
                                        <div className="ncv-grid-2">
                                            <FieldInput label="Titre du poste" value={exp.titre} onChange={v => updateArrayItem('experiences', i, 'titre', v)} />
                                            <FieldInput label="Entreprise" value={exp.entreprise} onChange={v => updateArrayItem('experiences', i, 'entreprise', v)} />
                                            <FieldInput label="Durée" value={exp.duree} onChange={v => updateArrayItem('experiences', i, 'duree', v)} />
                                            <FieldInput label="Lieu" value={exp.lieu} onChange={v => updateArrayItem('experiences', i, 'lieu', v)} />
                                        </div>
                                        <FieldTextarea label="Description" value={(exp.description || []).join('\n')} onChange={v => updateArrayItem('experiences', i, 'description', v.split('\n'))} rows={3} />
                                    </SubCard>
                                ))}
                                <AddBtn label="Ajouter une expérience" onClick={() => addArrayItem('experiences', { titre:'',entreprise:'',duree:'',lieu:'',description:[] })} />
                            </Card>

                            {/* Formations */}
                            <Card>
                                <div className="ncv-section-header">
                                    <SectionTitle icon="book" label="Formations" />
                                    <button className="ncv-add-header-btn"
                                        onClick={() => addArrayItem('formations', { diplome:'',etablissement:'',annee:'' })}>
                                        <Icon d={ICONS.plus} size={12} color="currentColor" /> Ajouter
                                    </button>
                                </div>
                                {profil.formations.map((f, i) => (
                                    <SubCard key={i}>
                                        <RemoveBtn onClick={() => removeArrayItem('formations', i)} />
                                        <div className="ncv-grid-2">
                                            <FieldInput label="Diplôme" value={f.diplome} onChange={v => updateArrayItem('formations', i, 'diplome', v)} />
                                            <FieldInput label="Établissement" value={f.etablissement} onChange={v => updateArrayItem('formations', i, 'etablissement', v)} />
                                            <FieldInput label="Année" value={f.annee} onChange={v => updateArrayItem('formations', i, 'annee', v)} />
                                        </div>
                                    </SubCard>
                                ))}
                                <AddBtn label="Ajouter une formation" onClick={() => addArrayItem('formations', { diplome:'',etablissement:'',annee:'' })} />
                            </Card>

                            {/* Compétences */}
                            <Card>
                                <div className="ncv-section-header">
                                    <SectionTitle icon="tool" label="Compétences" />
                                    <button className="ncv-add-header-btn"
                                        onClick={() => addArrayItem('competences', { categorie:'', elements:[] })}>
                                        <Icon d={ICONS.plus} size={12} color="currentColor" /> Catégorie
                                    </button>
                                </div>
                                {profil.competences.map((comp, ci) => (
                                    <SubCard key={ci}>
                                        <RemoveBtn onClick={() => removeArrayItem('competences', ci)} />
                                        <FieldInput label="Catégorie" value={comp.categorie} onChange={v => updateArrayItem('competences', ci, 'categorie', v)} />
                                        {/* ✅ FIX image 3 : chips avec border #64748B visible */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                                            {(comp.elements || []).map((el, ei) => (
                                                <span key={ei} className="ncv-comp-chip">
                                                    <input className="ncv-comp-input" value={el} placeholder="Compétence"
                                                        onChange={e => updateCompEl(ci, ei, e.target.value)} />
                                                    <button className="ncv-comp-remove" onClick={() => removeCompEl(ci, ei)}>
                                                        <Icon d={ICONS.x} size={11} color="currentColor" />
                                                    </button>
                                                </span>
                                            ))}
                                            <button className="ncv-comp-add" onClick={() => addCompEl(ci)}>
                                                <Icon d={ICONS.plus} size={11} color="currentColor" /> élément
                                            </button>
                                        </div>
                                    </SubCard>
                                ))}
                                <AddBtn label="Ajouter une catégorie" onClick={() => addArrayItem('competences', { categorie:'', elements:[] })} />
                            </Card>

                            {/* Projets */}
                            <Card>
                                <div className="ncv-section-header">
                                    <SectionTitle icon="folder" label="Projets" />
                                    <button className="ncv-add-header-btn"
                                        onClick={() => addArrayItem('projets', { nom:'',description:[],technologies:[] })}>
                                        <Icon d={ICONS.plus} size={12} color="currentColor" /> Ajouter
                                    </button>
                                </div>
                                {profil.projets.map((proj, i) => (
                                    <SubCard key={i}>
                                        <RemoveBtn onClick={() => removeArrayItem('projets', i)} />
                                        <FieldInput label="Nom du projet" value={proj.nom} onChange={v => updateArrayItem('projets', i, 'nom', v)} />
                                        <FieldTextarea label="Description" value={(proj.description || []).join('\n')} onChange={v => updateArrayItem('projets', i, 'description', v.split('\n'))} rows={2} />
                                        <FieldInput label="Technologies (séparées par des virgules)" value={(proj.technologies || []).join(', ')} onChange={v => updateArrayItem('projets', i, 'technologies', v.split(',').map(s => s.trim()))} />
                                    </SubCard>
                                ))}
                                <AddBtn label="Ajouter un projet" onClick={() => addArrayItem('projets', { nom:'',description:[],technologies:[] })} />
                            </Card>

                            {/* Langues */}
                            <Card>
                                <div className="ncv-section-header">
                                    <SectionTitle icon="globe" label="Langues" />
                                    <button className="ncv-add-header-btn"
                                        onClick={() => addArrayItem('langues', { nom:'', niveau:'' })}>
                                        <Icon d={ICONS.plus} size={12} color="currentColor" /> Ajouter
                                    </button>
                                </div>
                                {profil.langues.map((l, i) => {
                                    const parsed = typeof l === 'string' ? parseLangue(l) : l;
                                    return (
                                        <SubCard key={i}>
                                            <RemoveBtn onClick={() => removeArrayItem('langues', i)} />
                                            <div className="ncv-grid-2">
                                                <FieldInput label="Langue" value={parsed.nom || ''} onChange={v => updateArrayItem('langues', i, 'nom', v)} />
                                                <FieldInput label="Niveau" value={parsed.niveau || ''} onChange={v => updateArrayItem('langues', i, 'niveau', v)} placeholder="B2, Natif, Courant…" />
                                            </div>
                                        </SubCard>
                                    );
                                })}
                                <AddBtn label="Ajouter une langue" onClick={() => addArrayItem('langues', { nom:'', niveau:'' })} />
                            </Card>

                            {/* Actions step 2 */}
                            <div className="ncv-actions">
                                <button className="ncv-btn-secondary" onClick={() => setStep(1)}>
                                    ← Réimporter
                                </button>
                                <button className="ncv-btn-primary" onClick={validerProfil} disabled={loading}>
                                    {loading ? 'Enregistrement…' : 'Valider le profil'}
                                    <Icon d={ICONS.arrow} size={14} color="#fff" />
                                </button>
                            </div>
                        </>
                    )}

                    {/* ══ STEP 3 : Saisie et analyse de l'offre d'emploi ══ */}
                    {step === 3 && (
                        <>
                            <Card>
                                <SectionTitle icon="spark" label="Offre d'emploi" />
                                <FieldTextarea label="Collez le texte complet de l'offre d'emploi" value={texteOffre} onChange={setTexteOffre} rows={8} placeholder="Collez ici le texte de l'offre…" />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                    <button className="ncv-btn-primary" onClick={analyserOffre} disabled={!texteOffre.trim() || loading}>
                                        {loading ? 'Analyse…' : "Analyser l'offre"}
                                        {!loading && <Icon d={ICONS.arrow} size={14} color="#fff" />}
                                    </button>
                                </div>
                            </Card>

                            {loading && <Spinner msg="Analyse de l'offre en cours…" />}

                            {analyse && (
                                <Card ref={analyseRef}>
                                    <SectionTitle icon="check" label="Résultat de l'analyse" />
                                    <div className="ncv-grid-4">
                                        {[['Poste', analyse.titre_poste],['Entreprise', analyse.entreprise],['Niveau', analyse.niveau],['Contrat', analyse.type_contrat]].map(([lbl, val]) => (
                                            <div key={lbl} className="ncv-info-cell">
                                                <p className="ncv-cell-label">{lbl}</p>
                                                <p className="ncv-cell-value">{val || '—'}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: theme.text, margin: '0 0 10px' }}>Compétences requises</p>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                                        {(analyse.competences_requises || []).map(s => <span key={s} className="ncv-skill-req">{s}</span>)}
                                    </div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: theme.text, margin: '0 0 10px' }}>Compétences souhaitées</p>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {(analyse.competences_souhaitees || []).map(s => <span key={s} className="ncv-skill-opt">{s}</span>)}
                                    </div>
                                </Card>
                            )}

                            {analyse && (
                                <div ref={generateRef} className="ncv-actions">
                                    {loadingGen ? <Spinner msg="Génération du CV en cours…" /> : (
                                        <>
                                            <button className="ncv-btn-secondary" onClick={() => setStep(2)}>← Modifier le profil</button>
                                            <button className="ncv-btn-gen" onClick={genererCV}>
                                                <Icon d={ICONS.spark} size={14} color="#fff" />
                                                Générer le CV
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ══ STEP 4 : Affichage du CV/lettre généré(e) avec options ══ */}
                    {step === 4 && (
                        <Card>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                                <button className={!showLettre ? 'ncv-btn-primary' : 'ncv-btn-secondary'} onClick={() => setShowLettre(false)}>
                                    Voir le CV
                                </button>
                                {htmlLettre && (
                                    <button className={showLettre ? 'ncv-btn-primary' : 'ncv-btn-secondary'} onClick={() => setShowLettre(true)}>
                                        Voir la Lettre
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '8px 0' }}>
                                {(!showLettre && htmlCv) ? (
                                    <iframe srcDoc={htmlCv} title="Aperçu CV" style={{ width: '100%', maxWidth: 750, height: 900, border: `1px solid ${theme.border}`, borderRadius: 10, background: 'white' }} />
                                ) : (showLettre && htmlLettre) ? (
                                    <iframe srcDoc={htmlLettre} title="Aperçu Lettre" style={{ width: '100%', maxWidth: 750, height: 900, border: `1px solid ${theme.border}`, borderRadius: 10, background: 'white' }} />
                                ) : (
                                    <p style={{ color: theme.textSecondary, fontSize: 14 }}>Aucun aperçu à afficher</p>
                                )}
                                {/* ✅ FIX image 4 : boutons avec bon contraste */}
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <button className="ncv-btn-secondary" onClick={() => { setStep(1); setHtmlCv(null); setHtmlLettre(null); setShowLettre(false); setTexteOffre(''); setAnalyse(null); }}>
                                        <Icon d={ICONS.refresh} size={14} color="currentColor" /> Nouveau CV
                                    </button>
                                    <button className="ncv-btn-secondary" onClick={() => navigate('/historique')}>
                                        Voir l'historique
                                    </button>
                                    <button className="ncv-btn-primary" onClick={telecharger}>
                                        <Icon d={ICONS.download} size={14} color="#fff" /> Télécharger ({showLettre ? 'Lettre' : 'CV'})
                                    </button>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
};

export default Page_nouveau_cv; // Export par défaut du composant