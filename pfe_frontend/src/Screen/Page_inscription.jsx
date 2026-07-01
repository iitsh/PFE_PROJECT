// Import des hooks useState (état local) et useEffect (effets secondaires)
import { useState, useEffect } from 'react';
// Import du hook de navigation pour rediriger après inscription
import { useNavigate } from 'react-router-dom';

// ── Icône coche pour les fonctionnalités listées ──────────────────────────
const CheckIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

// ── Icône œil pour afficher/masquer le mot de passe ───────────────────────
// Accepte une prop "open" pour alterner entre œil ouvert et œil barré
const EyeIcon = ({ open }) => open
    // Œil ouvert : le mot de passe est visible
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    // Œil barré : le mot de passe est masqué
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
      </svg>;

// ── Fonctionnalités affichées dans le panneau gauche ──────────────────────
const FEATURES = [
    'CV adapté automatiquement à chaque offre', // Adaptation IA
    'Import de votre CV existant en PDF',       // Upload PDF
    'Génération PDF optimisée par IA',          // Sortie optimisée
];

// ── Règles de validation du mot de passe (affichées en temps réel) ─────────
// >>> Pattern "tableau de règles" : chaque règle est un objet { label,
//     test }, où test est une FONCTION qui retourne true/false. Permet de
//     boucler sur PW_RULES pour valider ET afficher chaque règle sans
//     dupliquer la logique — les MÊMES règles sont utilisées pour la
//     validation (valider()) ET l'affichage en temps réel (barre de force).
const PW_RULES = [
    { label: '12 caractères minimum', test: v => v.length >= 12 },          // Longueur min
    { label: 'Une majuscule',         test: v => /[A-Z]/.test(v) },         // Au moins 1 majuscule
    { label: 'Un chiffre',            test: v => /\d/.test(v) },            // Au moins 1 chiffre
    { label: 'Un caractère spécial',  test: v => /[!@#$%^&*(),.?":{}|<>]/.test(v) }, // Spécial
];

// ── Composant principal de la page d'inscription ──────────────────────────
export const Inscription = () => {
    // Hook de navigation pour rediriger vers /connexion après inscription
    const navigate = useNavigate();
    // État du formulaire : tous les champs de l'inscription
    const [formData, setFormData] = useState({
        nom: '', prenom: '', email: '',
        motDePasse: '', confirmerMotDePasse: '', numero: ''
    });
    // État des erreurs de validation par champ
    const [erreurs,      setErreurs]      = useState({});
    // État de chargement pendant l'appel API
    const [loading,      setLoading]      = useState(false);
    // Visibilité du mot de passe principal
    const [showPw,       setShowPw]       = useState(false);
    // Visibilité de la confirmation du mot de passe
    const [showPwConf,   setShowPwConf]   = useState(false);
    // Indique si le champ mot de passe est focusé (pour afficher la barre de force)
    const [pwFocused,    setPwFocused]    = useState(false);

    // ── Gestion des changements de champs ─────────────────────────────────
    const handleChange = (champ, valeur) => {
        setFormData(prev => ({ ...prev, [champ]: valeur })); // Met à jour le champ
        if (erreurs[champ]) setErreurs(prev => ({ ...prev, [champ]: '' })); // Efface l'erreur
    };

    // ── Vérification en temps réel de la correspondance des mots de passe ─
    // >>> useEffect avec dépendances [motDePasse, confirmerMotDePasse] :
    //     se relance CHAQUE FOIS que l'un de ces 2 champs change — c'est
    //     ce qui donne le feedback instantané "les mots de passe ne
    //     correspondent pas" pendant que l'utilisateur tape encore.
    useEffect(() => {
        // Vérifie seulement si les deux champs ont du contenu
        if (formData.motDePasse && formData.confirmerMotDePasse) {
            setErreurs(prev => ({
                ...prev,
                // Affiche une erreur si les mots de passe ne correspondent pas
                confirmerMotDePasse: formData.motDePasse !== formData.confirmerMotDePasse
                    ? 'Les mots de passe ne correspondent pas' : ''
            }));
        }
    }, [formData.motDePasse, formData.confirmerMotDePasse]); // Relance à chaque changement

    // ── Validation complète du formulaire ─────────────────────────────────
    const valider = () => {
        const e = {}; // Objet d'erreurs à remplir

        // Validation du nom (obligatoire, pas de chiffres)
        if (!formData.nom.trim())    e.nom    = 'Le nom est obligatoire';
        else if (/\d/.test(formData.nom)) e.nom = 'Le nom ne doit pas contenir de chiffres';

        // Validation du prénom (obligatoire, pas de chiffres)
        if (!formData.prenom.trim()) e.prenom = 'Le prénom est obligatoire';
        else if (/\d/.test(formData.prenom)) e.prenom = 'Le prénom ne doit pas contenir de chiffres';

        // Validation du numéro (10 chiffres exactement)
        if (!formData.numero.trim()) e.numero = 'Le numéro est obligatoire';
        else if (!/^\d+$/.test(formData.numero.trim())) e.numero = 'Chiffres uniquement';
        else if (formData.numero.trim().length !== 10)  e.numero = 'Exactement 10 chiffres';

        // Validation de l'email (format standard)
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim())                e.email = "L'email est obligatoire";
        else if (!emailRx.test(formData.email))    e.email = "Format d'email invalide";

        // Validation du mot de passe (règles de complexité)
        if (!formData.motDePasse)    e.motDePasse = 'Le mot de passe est obligatoire';
        // >>> .some(callback) = retourne true si AU MOINS UNE règle échoue
        //     (r.test(...) renvoie false). Une seule règle non respectée
        //     suffit à rejeter le mot de passe entier.
        else if (PW_RULES.some(r => !r.test(formData.motDePasse)))
            e.motDePasse = 'Le mot de passe ne respecte pas les critères';

        // Validation de la confirmation (doit correspondre)
        if (!formData.confirmerMotDePasse) e.confirmerMotDePasse = 'Confirmation obligatoire';
        else if (formData.motDePasse !== formData.confirmerMotDePasse)
            e.confirmerMotDePasse = 'Les mots de passe ne correspondent pas';

        setErreurs(e); // Stocke les erreurs
        return Object.keys(e).length === 0; // true si aucune erreur
    };

    // ── Soumission du formulaire d'inscription ────────────────────────────
    const handleInscription = async () => {
        if (!valider()) return; // Valide d'abord
        setLoading(true); // Active le spinner
        try {
            // Appel POST vers l'API d'inscription
            const res = await fetch('http://localhost:8000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: formData.nom, prenom: formData.prenom,
                    email: formData.email, motDePasse: formData.motDePasse,
                    numero: formData.numero,
                }),
            });
            if (!res.ok) {
                // Erreur retournée par le serveur (email déjà utilisé, etc.)
                const err = await res.json();
                setErreurs({ general: err.detail || "Erreur lors de l'inscription" });
                return;
            }
            // Inscription réussie : redirige vers la page de connexion
            navigate('/connexion');
        } catch (_) {
            setErreurs({ general: 'Impossible de contacter le serveur' }); // Erreur réseau
        } finally {
            setLoading(false); // Désactive le spinner
        }
    };

    // ── Calcul de la force du mot de passe (0 à 4 règles validées) ───────
    // >>> .filter(callback) = garde uniquement les règles où r.test(...)
    //     retourne true, .length compte combien il en reste. Résultat :
    //     un nombre de 0 (aucune règle respectée) à 4 (toutes respectées),
    //     utilisé ensuite pour la couleur et la largeur de la barre de force.
    const pwStrength = PW_RULES.filter(r => r.test(formData.motDePasse)).length;

    return (
        <>
            {/* ── Styles scopés pour la page d'inscription ── */}
            <style>{`
                /* Racine : layout flex plein écran */
                .ins-root { display: flex; min-height: 100vh; font-family: var(--sans); }

                /* ── Panneau gauche : branding sombre ── */
                .ins-left {
                    width: 38%;
                    background: #0F172A;
                    padding: 48px 44px;
                    display: flex; flex-direction: column; justify-content: space-between;
                    position: relative; overflow: hidden;
                }
                /* Halo lumineux décoratif en haut à droite */
                .ins-left::before {
                    content: ''; position: absolute; top: -100px; right: -100px;
                    width: 280px; height: 280px;
                    background: radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%);
                    pointer-events: none;
                }
                /* Halo lumineux en bas à gauche */
                .ins-left::after {
                    content: ''; position: absolute; bottom: -60px; left: -60px;
                    width: 220px; height: 220px;
                    background: radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 70%);
                    pointer-events: none;
                }
                /* Marque : logo + nom */
                .ins-brand { display: flex; align-items: center; gap: 11px; }
                .ins-brand-name { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
                .ins-brand-dot  { color: #60A5FA; } /* Point coloré */
                /* Titre d'accroche */
                .ins-hero-title { font-size: 24px; font-weight: 700; color: #fff; line-height: 1.25; letter-spacing: -0.02em; margin: 0 0 10px; }
                /* Sous-titre */
                .ins-hero-sub   { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.65; margin: 0 0 28px; }
                /* Liste des fonctionnalités */
                .ins-features   { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 11px; }
                .ins-feature-item { display: flex; align-items: center; gap: 9px; font-size: 13px; color: rgba(255,255,255,0.6); }
                .ins-feat-icon  { width: 20px; height: 20px; background: rgba(37,99,235,0.32); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                /* Copyright */
                .ins-footer-note { font-size: 11.5px; color: rgba(255,255,255,0.22); }

                /* ── Panneau droit : formulaire ── */
                .ins-right { flex: 1; display: flex; align-items: flex-start; justify-content: center; background: var(--bg); padding: 40px 32px; overflow-y: auto; }
                .ins-form-box { width: 100%; max-width: 420px; padding-top: 8px; animation: insUp 0.3s ease both; }
                /* Animation d'entrée vers le haut */
                @keyframes insUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

                /* Titre et sous-titre */
                .ins-heading    { font-size: 1.5rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; margin: 0 0 5px; }
                .ins-subheading { font-size: 0.875rem; color: var(--text-secondary); margin: 0 0 28px; }

                /* Alerte d'erreur générale */
                .ins-alert {
                    background: var(--error-light); border: 1px solid rgba(220,38,38,0.2);
                    color: var(--error); padding: 11px 14px; border-radius: 8px;
                    font-size: 0.875rem; font-weight: 500; margin-bottom: 18px;
                    display: flex; align-items: center; gap: 8px;
                }

                /* Ligne avec 2 champs côte à côte (nom + prénom) */
                .ins-row { display: flex; gap: 12px; }
                .ins-row .ins-field { flex: 1; } /* Chaque champ prend la moitié */

                /* Champ de formulaire */
                .ins-field { display: flex; flex-direction: column; margin-bottom: 14px; }
                .ins-label { font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; }
                .ins-input-wrap { position: relative; } /* Pour positionner le toggle mdp */
                /* Input : styles de base */
                .ins-input {
                    width: 100%; padding: 10px 14px; border: 1.5px solid var(--border);
                    border-radius: 8px; font-size: 0.9375rem; color: var(--text);
                    background: var(--bg); font-family: inherit; outline: none;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                    box-sizing: border-box;
                }
                .ins-input:focus  { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.11); }
                .ins-input.error  { border-color: var(--error) !important; } /* Bordure rouge en erreur */
                .ins-input.error:focus { box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
                .ins-input-pw     { padding-right: 42px !important; } /* Espace pour le toggle */
                /* Bouton toggle mot de passe */
                .ins-pw-toggle {
                    position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; cursor: pointer; padding: 2px;
                    color: var(--text-muted); display: flex; align-items: center;
                    transition: color 0.13s ease;
                }
                .ins-pw-toggle:hover { color: var(--text); }
                /* Erreur sous le champ */
                .ins-field-error  { font-size: 0.74rem; color: var(--error); font-weight: 500; margin-top: 4px; }

                /* Barre de force du mot de passe */
                .ins-strength-wrap { margin-top: 8px; }
                .ins-strength-bar  { height: 3px; border-radius: 99px; background: var(--border); overflow: hidden; margin-bottom: 6px; }
                .ins-strength-fill { height: 100%; border-radius: 99px; transition: width 0.3s ease, background 0.3s ease; }
                /* Liste des règles de mot de passe */
                .ins-strength-rules { display: flex; flex-direction: column; gap: 3px; }
                .ins-rule { font-size: 0.72rem; display: flex; align-items: center; gap: 5px; }
                .ins-rule-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }

                /* Bouton de soumission */
                .ins-submit {
                    width: 100%; background: var(--accent); color: #fff;
                    border: none; border-radius: 9px; padding: 12px;
                    font-size: 0.9375rem; font-weight: 600; cursor: pointer;
                    font-family: inherit; margin-top: 10px;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
                }
                .ins-submit:hover:not(:disabled) { background: var(--accent-hover); }
                .ins-submit:active:not(:disabled) { transform: scale(0.985); }
                .ins-submit:disabled { opacity: 0.6; cursor: not-allowed; }
                /* Spinner de chargement */
                .ins-spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation: insSpin .7s linear infinite; }
                @keyframes insSpin { to { transform: rotate(360deg); } }

                /* Footer du formulaire */
                .ins-form-footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.875rem; color: var(--text-secondary); }
                .ins-link { color: var(--accent); font-weight: 600; cursor: pointer; background: none; border: none; font-size: 0.875rem; font-family: inherit; padding: 0; margin-left: 4px; transition: color 0.13s ease; }
                .ins-link:hover { color: var(--accent-hover); }

                /* Responsive : cache le panneau gauche sur mobile */
                @media (max-width: 768px) {
                    .ins-left  { display: none; }
                    .ins-right { padding: 28px 20px; align-items: flex-start; }
                }
                /* Très petit écran : empile les champs nom/prénom */
                @media (max-width: 480px) {
                    .ins-row { flex-direction: column; gap: 0; }
                }
            `}</style>

            <div className="ins-root">

                {/* ══ Panneau gauche : branding ══ */}
                <div className="ins-left">
                    {/* Logo et nom de la marque */}
                    <div className="ins-brand">
                        <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                            <rect width="30" height="30" rx="8" fill="rgba(255,255,255,0.12)" />
                            <path d="M8 9h8M8 13h11M8 17h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M20 17l3 3-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="ins-brand-name">CVGen<span className="ins-brand-dot">.</span></span>
                    </div>

                    {/* Texte central avec fonctionnalités */}
                    <div>
                        <h2 className="ins-hero-title">Créez votre compte<br />et générez votre CV.</h2>
                        <p className="ins-hero-sub">Importez votre CV existant, collez une offre d'emploi — l'IA s'occupe du reste.</p>
                        {/* Liste des fonctionnalités */}
                        <ul className="ins-features">
                            {FEATURES.map(f => (
                                <li key={f} className="ins-feature-item">
                                    <span className="ins-feat-icon"><CheckIcon /></span>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Copyright */}
                    <p className="ins-footer-note">CVGen · Tous droits réservés</p>
                </div>

                {/* ══ Panneau droit : formulaire d'inscription ══ */}
                <div className="ins-right">
                    <div className="ins-form-box">

                        {/* Titre du formulaire */}
                        <h1 className="ins-heading">Créer un compte</h1>
                        <p className="ins-subheading">Remplissez le formulaire pour commencer</p>

                        {/* Alerte d'erreur générale */}
                        {erreurs.general && (
                            <div className="ins-alert">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                                </svg>
                                {erreurs.general}
                            </div>
                        )}

                        {/* Ligne Nom + Prénom (2 champs côte à côte) */}
                        <div className="ins-row">
                            {/* Champ Nom */}
                            <div className="ins-field">
                                <label className="ins-label">Nom</label>
                                <input className={`ins-input${erreurs.nom ? ' error' : ''}`} type="text"
                                    placeholder="Dupont" value={formData.nom}
                                    onChange={e => handleChange('nom', e.target.value)} />
                                {erreurs.nom && <p className="ins-field-error">{erreurs.nom}</p>}
                            </div>
                            {/* Champ Prénom */}
                            <div className="ins-field">
                                <label className="ins-label">Prénom</label>
                                <input className={`ins-input${erreurs.prenom ? ' error' : ''}`} type="text"
                                    placeholder="Jean" value={formData.prenom}
                                    onChange={e => handleChange('prenom', e.target.value)} />
                                {erreurs.prenom && <p className="ins-field-error">{erreurs.prenom}</p>}
                            </div>
                        </div>

                        {/* Champ Numéro de téléphone */}
                        <div className="ins-field">
                            <label className="ins-label">Numéro de téléphone</label>
                            <input className={`ins-input${erreurs.numero ? ' error' : ''}`} type="tel"
                                placeholder="0612345678" value={formData.numero}
                                onChange={e => handleChange('numero', e.target.value)} />
                            {erreurs.numero && <p className="ins-field-error">{erreurs.numero}</p>}
                        </div>

                        {/* Champ Email */}
                        <div className="ins-field">
                            <label className="ins-label">Adresse email</label>
                            <input className={`ins-input${erreurs.email ? ' error' : ''}`} type="email"
                                placeholder="vous@exemple.com" value={formData.email}
                                onChange={e => handleChange('email', e.target.value)}
                                autoComplete="email" />
                            {erreurs.email && <p className="ins-field-error">{erreurs.email}</p>}
                        </div>

                        {/* Champ Mot de passe avec barre de force */}
                        <div className="ins-field">
                            <label className="ins-label">Mot de passe</label>
                            <div className="ins-input-wrap">
                                <input
                                    className={`ins-input ins-input-pw${erreurs.motDePasse ? ' error' : ''}`}
                                    type={showPw ? 'text' : 'password'} // Alterne visible/masqué
                                    placeholder="••••••••••••"
                                    value={formData.motDePasse}
                                    onChange={e => handleChange('motDePasse', e.target.value)}
                                    onFocus={() => setPwFocused(true)} // Affiche la barre de force
                                    onBlur={() => setPwFocused(false)} // Masque la barre
                                    autoComplete="new-password"
                                />
                                {/* Bouton toggle visibilité */}
                                <button type="button" className="ins-pw-toggle"
                                    onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                                    <EyeIcon open={showPw} />
                                </button>
                            </div>

                            {/* Barre de force + règles (visible si focus ou mot de passe saisi) */}
                            {(pwFocused || formData.motDePasse) && (
                                <div className="ins-strength-wrap">
                                    {/* Barre de progression : largeur proportionnelle aux règles validées */}
                                    <div className="ins-strength-bar">
                                        <div className="ins-strength-fill" style={{
                                            width: `${(pwStrength / 4) * 100}%`, // 0% à 100%
                                            // Couleur : rouge→orange→jaune→vert selon la force
                                            // >>> Indexation directe par pwStrength (0 à 4) dans un
                                            //     tableau de 5 couleurs — évite un switch/if imbriqué.
                                            background: ['transparent','#EF4444','#F97316','#EAB308','#16A34A'][pwStrength],
                                        }} />
                                    </div>
                                    {/* Liste des règles avec indicateur vert/gris */}
                                    <div className="ins-strength-rules">
                                        {PW_RULES.map(r => {
                                            const ok = r.test(formData.motDePasse); // Vérifie la règle
                                            return (
                                                <span key={r.label} className="ins-rule" style={{
                                                    color: ok ? '#16A34A' : 'var(--text-muted)' // Vert si OK, gris sinon
                                                }}>
                                                    <span className="ins-rule-dot" style={{
                                                        background: ok ? '#16A34A' : 'var(--border)' // Point vert/gris
                                                    }} />
                                                    {r.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {erreurs.motDePasse && <p className="ins-field-error">{erreurs.motDePasse}</p>}
                        </div>

                        {/* Champ Confirmation du mot de passe */}
                        <div className="ins-field">
                            <label className="ins-label">Confirmer le mot de passe</label>
                            <div className="ins-input-wrap">
                                <input
                                    className={`ins-input ins-input-pw${erreurs.confirmerMotDePasse ? ' error' : ''}`}
                                    type={showPwConf ? 'text' : 'password'}
                                    placeholder="••••••••••••"
                                    value={formData.confirmerMotDePasse}
                                    onChange={e => handleChange('confirmerMotDePasse', e.target.value)}
                                    autoComplete="new-password"
                                />
                                {/* Bouton toggle visibilité confirmation */}
                                <button type="button" className="ins-pw-toggle"
                                    onClick={() => setShowPwConf(v => !v)} tabIndex={-1}>
                                    <EyeIcon open={showPwConf} />
                                </button>
                            </div>
                            {erreurs.confirmerMotDePasse && <p className="ins-field-error">{erreurs.confirmerMotDePasse}</p>}
                        </div>

                        {/* Bouton de soumission */}
                        <button className="ins-submit" onClick={handleInscription} disabled={loading}>
                            {/* Spinner + texte ou texte seul */}
                            {loading
                                ? <><span className="ins-spinner" /> Inscription en cours…</>
                                : "Créer mon compte"}
                        </button>

                        {/* Footer : lien vers la page de connexion */}
                        <div className="ins-form-footer">
                            Déjà un compte ?
                            <button className="ins-link" onClick={() => navigate('/connexion')}>
                                Se connecter
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
};

// Export par défaut du composant Inscription
export default Inscription;