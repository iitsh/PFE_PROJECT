// Import du hook useState pour gérer l'état local du formulaire
import { useState } from 'react';
// Import du hook de navigation pour rediriger après connexion
import { useNavigate } from 'react-router-dom';
// Import du thème centralisé (couleurs, tokens)
import { theme } from '../theme';

/* ── Logo inline : version SVG du logo pour la page de connexion ────────── */
// Logo avec fond semi-transparent blanc sur panneau sombre
const Logo = () => (
    // SVG 36×36 avec rectangle arrondi semi-transparent
    <svg width="36" height="36" viewBox="0 0 30 30" fill="none">
        <rect width="30" height="30" rx="8" fill="rgba(255,255,255,0.15)" />
        {/* Lignes simulant du texte de CV */}
        <path d="M8 9h8M8 13h11M8 17h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        {/* Chevron d'action */}
        <path d="M20 17l3 3-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ── Icône coche pour les features listées dans le panneau gauche ───────────
const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

// ── Liste des fonctionnalités affichées dans le panneau de gauche ──────────
const FEATURES = [
    'Import PDF de votre CV existant',           // Fonctionnalité 1 : upload
    'Adaptation automatique aux offres d\'emploi', // Fonctionnalité 2 : IA
    'Génération PDF en 1 page optimisée',         // Fonctionnalité 3 : PDF
];

// ── Composant principal de la page de connexion ───────────────────────────
// Props : setAccessToken pour stocker le JWT après connexion réussie
export const Connexion = ({ setAccessToken }) => {
    // Hook de navigation pour rediriger vers /accueil après login
    const navigate = useNavigate();

    // État du formulaire : email et mot de passe
    const [formData, setFormData]       = useState({ email: '', motDePasse: '' });
    // État des erreurs de validation par champ
    const [erreurs, setErreurs]         = useState({});
    // État de chargement pendant l'appel API
    const [loading, setLoading]         = useState(false);
    // État pour afficher/masquer le mot de passe
    const [showPassword, setShowPassword] = useState(false);

    // ── Gestion des changements de champs ─────────────────────────────────
    // Met à jour la valeur du champ et efface l'erreur associée
    // >>> Pattern "composant contrôlé" React : la valeur de l'input est
    //     TOUJOURS dérivée de formData (value={formData.email}), jamais
    //     lue directement depuis le DOM — React est la seule source de
    //     vérité. [champ] = "computed property name", permet d'utiliser
    //     une variable comme clé d'objet dynamiquement.
    const handleChange = (champ, valeur) => {
        setFormData(prev => ({ ...prev, [champ]: valeur })); // Met à jour le champ
        if (erreurs[champ]) setErreurs(prev => ({ ...prev, [champ]: '' })); // Efface l'erreur
    };

    // ── Validation du formulaire côté client ──────────────────────────────
    // Sur la page de connexion, on ne vérifie QUE la présence des champs.
    // On ne révèle PAS la politique de mot de passe (faille de sécurité).
    // La validation complète du mdp est faite uniquement à l'inscription.
    // >>> DÉCISION DE SÉCURITÉ IMPORTANTE : si on affichait "12 caractères
    //     min, 1 majuscule..." sur l'écran de LOGIN, un attaquant pourrait
    //     déduire la politique de mot de passe sans avoir de compte. Cette
    //     validation reste côté client — la vraie sécurité est refaite
    //     côté serveur dans routes/auth.py (jamais faire confiance au client).
    const validerFormulaire = () => {
        const nouvellesErreurs = {}; // Objet pour accumuler les erreurs

        // Validation de l'email : présence et format basique
        if (!formData.email.trim())
            nouvellesErreurs.email = "L'email est obligatoire";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
            nouvellesErreurs.email = "Format d'email invalide";

        // Validation du mot de passe : on vérifie UNIQUEMENT qu'il est rempli
        // Aucun détail sur la politique (longueur, complexité) n'est révélé
        if (!formData.motDePasse)
            nouvellesErreurs.motDePasse = 'Le mot de passe est obligatoire';

        // Stocke les erreurs dans l'état
        setErreurs(nouvellesErreurs);
        // Retourne true si aucune erreur n'a été trouvée
        return Object.keys(nouvellesErreurs).length === 0;
    };

    // ── Gestion de la soumission du formulaire ────────────────────────────
    // >>> Flux complet : valide → POST /login → si succès, stocke le token
    //     en mémoire React (pas localStorage) → redirige vers /accueil.
    const handleConnexion = async () => {
        // Valide le formulaire avant d'envoyer
        if (!validerFormulaire()) return;
        // Active l'état de chargement
        setLoading(true);
        try {
            // Appel POST vers l'API de connexion
            const res = await fetch('http://localhost:8000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Envoie du JSON
                // >>> credentials: 'include' = le navigateur acceptera de
                //     STOCKER le cookie refreshToken renvoyé par le serveur
                //     dans la réponse (Set-Cookie). Sans ça, même si le
                //     backend envoie le cookie, il serait ignoré.
                credentials: 'include', // Inclut les cookies (pour le refresh token)
                body: JSON.stringify({ email: formData.email, motDePasse: formData.motDePasse }),
            });
            if (!res.ok) {
                // Erreur d'authentification (mauvais identifiants)
                const err = await res.json();
                setErreurs({ general: err.detail || 'Email ou mot de passe incorrect' });
                return;
            }
            // Connexion réussie : récupère le JWT
            const data = await res.json();
            setAccessToken(data.accessToken); // Stocke le token dans l'état global
            navigate('/accueil'); // Redirige vers la page d'accueil
        } catch (e) {
            console.error(e);
            setErreurs({ general: 'Impossible de contacter le serveur' }); // Erreur réseau
        } finally {
            setLoading(false); // Désactive le chargement dans tous les cas
        }
    };

    // ── Gestion de la touche Entrée pour soumettre ────────────────────────
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleConnexion(); // Lance la connexion sur Entrée
    };

    return (
        <>
            {/* ── Styles scopés pour la page de connexion ── */}
            <style>{`
                /* Racine : flexbox plein écran */
                .conn-root {
                    display: flex;
                    min-height: 100vh;
                    font-family: var(--sans);
                }

                /* ── Panneau gauche : branding sombre ── */
                .conn-left {
                    width: 42%; /* 42% de la largeur */
                    background: #0F172A; /* Bleu très sombre */
                    padding: 56px 52px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between; /* Espace entre logo, texte et footer */
                    position: relative;
                    overflow: hidden;
                }
                /* Halo lumineux en haut à droite (effet décoratif) */
                .conn-left::before {
                    content: '';
                    position: absolute;
                    top: -120px; right: -120px;
                    width: 320px; height: 320px;
                    background: radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%);
                    pointer-events: none;
                }
                /* Halo lumineux en bas à gauche */
                .conn-left::after {
                    content: '';
                    position: absolute;
                    bottom: -80px; left: -60px;
                    width: 240px; height: 240px;
                    background: radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%);
                    pointer-events: none;
                }
                /* Lien de la marque (logo + nom) */
                .conn-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    text-decoration: none;
                }
                /* Nom de la marque */
                .conn-brand-name {
                    font-size: 17px;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: -0.02em;
                }
                /* Point coloré après le nom */
                .conn-brand-dot { color: #60A5FA; }
                /* Titre d'accroche sur le panneau sombre */
                .conn-hero-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: #fff;
                    line-height: 1.2;
                    letter-spacing: -0.02em;
                    margin: 0 0 12px;
                }
                /* Sous-titre descriptif */
                .conn-hero-sub {
                    font-size: 15px;
                    color: rgba(255,255,255,0.55);
                    line-height: 1.65;
                    margin: 0 0 32px;
                }
                /* Liste des fonctionnalités */
                .conn-features {
                    list-style: none;
                    padding: 0; margin: 0;
                    display: flex; flex-direction: column; gap: 12px;
                }
                /* Item de fonctionnalité (icône + texte) */
                .conn-feature-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13.5px;
                    color: rgba(255,255,255,0.65);
                }
                /* Cercle d'icône de fonctionnalité */
                .conn-feat-icon {
                    width: 22px; height: 22px;
                    background: rgba(37,99,235,0.35);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                /* Note de copyright en bas du panneau */
                .conn-footer-note {
                    font-size: 12px;
                    color: rgba(255,255,255,0.28);
                }

                /* ── Panneau droit : formulaire de connexion ── */
                .conn-right {
                    flex: 1; /* Prend tout l'espace restant */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg);
                    padding: 48px 32px;
                }
                /* Boîte du formulaire : largeur max et animation d'entrée */
                .conn-form-box {
                    width: 100%;
                    max-width: 400px;
                    animation: fadeUp 0.3s ease both;
                }
                /* Animation de fondu vers le haut */
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* Titre "Connexion" */
                .conn-heading {
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: var(--text);
                    letter-spacing: -0.02em;
                    margin: 0 0 6px;
                }
                /* Sous-titre sous le heading */
                .conn-subheading {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0 0 32px;
                }

                /* Alerte d'erreur générale (email/mdp incorrect) */
                .conn-alert {
                    background: var(--error-light);
                    border: 1px solid rgba(220,38,38,0.2);
                    color: var(--error);
                    padding: 11px 14px;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                /* Champ de formulaire (label + input) */
                .conn-field { display: flex; flex-direction: column; margin-bottom: 18px; }
                /* Label au-dessus de l'input */
                .conn-label {
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 6px;
                }
                /* Conteneur relatif pour positionner le toggle mot de passe */
                .conn-input-wrap { position: relative; }
                /* Champ de saisie : styles de base */
                .conn-input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid var(--border);
                    border-radius: 8px;
                    font-size: 0.9375rem;
                    color: var(--text);
                    background: var(--bg);
                    font-family: inherit;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                    box-sizing: border-box;
                    outline: none;
                }
                /* Focus : bordure accent + halo */
                .conn-input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
                }
                /* Input en erreur : bordure rouge */
                .conn-input.conn-error { border-color: var(--error) !important; }
                .conn-input.conn-error:focus { box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
                /* Padding droit supplémentaire pour l'input mot de passe (toggle) */
                .conn-input-pw { padding-right: 44px !important; }
                /* Bouton toggle affichage du mot de passe (œil) */
                .conn-pw-toggle {
                    position: absolute;
                    right: 12px; top: 50%;
                    transform: translateY(-50%);
                    background: none; border: none;
                    cursor: pointer; padding: 2px;
                    color: var(--text-muted);
                    display: flex; align-items: center;
                    transition: color 0.13s ease;
                }
                .conn-pw-toggle:hover { color: var(--text); }
                /* Message d'erreur sous le champ */
                .conn-field-error {
                    font-size: 0.75rem;
                    color: var(--error);
                    font-weight: 500;
                    margin-top: 5px;
                }

                /* Bouton de soumission "Se connecter" */
                .conn-submit {
                    width: 100%;
                    background: var(--accent);
                    color: #fff;
                    border: none;
                    border-radius: 9px;
                    padding: 12px;
                    font-size: 0.9375rem;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: inherit;
                    transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
                    margin-top: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .conn-submit:hover:not(:disabled) { background: var(--accent-hover); }
                .conn-submit:active:not(:disabled) { transform: scale(0.985); }
                .conn-submit:disabled { opacity: 0.65; cursor: not-allowed; } /* État désactivé */

                /* Spinner de chargement (cercle qui tourne) */
                .conn-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Footer du formulaire : lien vers inscription */
                .conn-form-footer {
                    text-align: center;
                    margin-top: 24px;
                    padding-top: 24px;
                    border-top: 1px solid var(--border);
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }
                /* Lien cliquable vers la page d'inscription */
                .conn-link {
                    color: var(--accent);
                    font-weight: 600;
                    cursor: pointer;
                    background: none;
                    border: none;
                    font-size: 0.875rem;
                    font-family: inherit;
                    padding: 0;
                    text-decoration: none;
                    margin-left: 4px;
                    transition: color 0.13s ease;
                }
                .conn-link:hover { color: var(--accent-hover); }

                /* Responsive : cache le panneau gauche sur mobile */
                @media (max-width: 768px) {
                    .conn-left { display: none; }
                    .conn-right { padding: 32px 20px; }
                }
            `}</style>

            <div className="conn-root">

                {/* ══ Panneau gauche : branding et accroche ══ */}
                <div className="conn-left">
                    <div>
                        {/* Logo et nom de la marque */}
                        <div className="conn-brand">
                            <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
                                <rect width="30" height="30" rx="8" fill="rgba(255,255,255,0.12)" />
                                <path d="M8 9h8M8 13h11M8 17h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                                <path d="M20 17l3 3-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="conn-brand-name">
                                CVGen<span className="conn-brand-dot">.</span>
                            </span>
                        </div>
                    </div>

                    {/* Texte central : titre, description et features */}
                    <div>
                        <h2 className="conn-hero-title">
                            Votre CV parfait,<br />en quelques secondes.
                        </h2>
                        <p className="conn-hero-sub">
                            Importez votre CV, collez une offre d'emploi — l'IA s'occupe du reste.
                        </p>
                        {/* Liste des fonctionnalités avec icônes coches */}
                        <ul className="conn-features">
                            {FEATURES.map((f) => (
                                <li key={f} className="conn-feature-item">
                                    <span className="conn-feat-icon"><CheckIcon /></span>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Copyright en bas du panneau */}
                    <p className="conn-footer-note">CVGen · Tous droits réservés</p>
                </div>

                {/* ══ Panneau droit : formulaire de connexion ══ */}
                <div className="conn-right">
                    <div className="conn-form-box">

                        {/* Titre et sous-titre du formulaire */}
                        <h1 className="conn-heading">Connexion</h1>
                        <p className="conn-subheading">Connectez-vous à votre compte</p>

                        {/* Alerte d'erreur générale (mauvais identifiants) */}
                        {erreurs.general && (
                            <div className="conn-alert">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                                {erreurs.general}
                            </div>
                        )}

                        {/* Champ email */}
                        <div className="conn-field">
                            <label className="conn-label">Adresse email</label>
                            <input
                                type="email"
                                placeholder="vous@exemple.com"
                                // Ajoute la classe erreur si le champ a une erreur
                                className={`conn-input ${erreurs.email ? 'conn-error' : ''}`}
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                onKeyDown={handleKeyDown} // Soumet sur Entrée
                                autoComplete="email" // Auto-complétion navigateur
                            />
                            {/* Message d'erreur sous le champ email */}
                            {erreurs.email && <p className="conn-field-error">{erreurs.email}</p>}
                        </div>

                        {/* Champ mot de passe */}
                        <div className="conn-field">
                            <label className="conn-label">Mot de passe</label>
                            <div className="conn-input-wrap">
                                <input
                                    // Alterne entre type password (masqué) et text (visible)
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••••••"
                                    className={`conn-input conn-input-pw ${erreurs.motDePasse ? 'conn-error' : ''}`}
                                    value={formData.motDePasse}
                                    onChange={(e) => handleChange('motDePasse', e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="current-password"
                                />
                                {/* Bouton pour afficher/masquer le mot de passe */}
                                <button
                                    type="button"
                                    className="conn-pw-toggle"
                                    onClick={() => setShowPassword(v => !v)} // Bascule la visibilité
                                    tabIndex={-1} // Ne pas tabuler sur ce bouton
                                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                                >
                                    {/* Icône œil barré (masquer) ou œil ouvert (afficher) */}
                                    {showPassword
                                        ? /* Œil barré : masque le mot de passe */
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <path d="M1 1l22 22" /> {/* Barre diagonale */}
                                        </svg>
                                        : /* Œil ouvert : affiche le mot de passe */
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    }
                                </button>
                            </div>
                            {/* Message d'erreur sous le champ mot de passe */}
                            {erreurs.motDePasse && <p className="conn-field-error">{erreurs.motDePasse}</p>}
                        </div>

                        {/* Bouton de soumission */}
                        <button
                            className="conn-submit"
                            onClick={handleConnexion}
                            disabled={loading} // Désactivé pendant le chargement
                        >
                            {/* Affiche spinner + texte ou juste le texte selon l'état */}
                            {loading
                                ? <><span className="conn-spinner" /> Connexion en cours…</>
                                : 'Se connecter'
                            }
                        </button>

                        {/* Footer : lien vers la page d'inscription */}
                        <div className="conn-form-footer">
                            Pas encore de compte ?
                            <button className="conn-link" onClick={() => navigate('/inscription')}>
                                S'inscrire
                            </button>
                        </div>

                    </div>
                </div>

            </div>
        </>
    );
};

// Export par défaut du composant Connexion
export default Connexion;