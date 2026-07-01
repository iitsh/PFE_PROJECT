// Import des hooks React : useState (état local), useEffect (effets au montage)
import { useState, useEffect } from 'react';
// Import du hook de navigation pour les redirections
import { useNavigate } from 'react-router-dom';
// Import du composant Navbar (barre de navigation)
import Navbar from './Navbar';
// Import du thème centralisé (couleurs, tokens de design)
import { theme } from '../theme';

// ══ Page Profil : édition des informations personnelles de l'utilisateur ════
// Permet de modifier nom, prénom, email et numéro de téléphone
export const Page_profil = ({ accessToken }) => {
    const navigate = useNavigate(); // Hook de navigation (non utilisé ici mais disponible)

    // ── États locaux du composant ──────────────────────────────────────────────
    const [profil,  setProfil]  = useState({ nom: '', prenom: '', email: '', numero: '' }); // Données du profil
    const [erreurs, setErreurs] = useState({}); // Erreurs de validation par champ
    const [toast,   setToast]   = useState(false); // Affiche le toast de confirmation
    const [loading, setLoading] = useState(true); // Chargement initial du profil
    const [saving,  setSaving]  = useState(false); // Envoi du formulaire en cours

    // ── Effet au montage : récupère le profil depuis l'API ─────────────────────
    // >>> Route utilisée : GET /api/auth/me — retourne les infos de l'utilisateur
    //     CONNECTÉ (déduites du JWT décodé côté serveur, pas d'ID dans l'URL).
    //     C'est différent de GET /api/cv/profil (routes/cv.py) qui retourne
    //     TOUT le CV (expériences, formations...) — /me ne retourne que
    //     l'identité de base (nom, prénom, email, numéro).
    useEffect(() => {
        // Fonction asynchrone pour charger les données du profil
        const fetchProfil = async () => {
            try {
                // Appelle le endpoint /api/auth/me pour obtenir les infos de l'utilisateur
                const res = await fetch("http://localhost:8000/api/auth/me", {
                    headers: { "Authorization": `Bearer ${accessToken}` } // Envoie le token JWT
                });
                if (!res.ok) throw new Error("Erreur chargement profil"); // Erreur HTTP
                const data = await res.json(); // Parse la réponse JSON
                // Remplit les champs du profil avec les données reçues
                setProfil({ nom: data.nom || '', prenom: data.prenom || '', email: data.email || '', numero: data.numero || '' });
            } catch (error) { console.error(error); } // Log l'erreur en console
            finally { setLoading(false); } // Fin du chargement dans tous les cas
        };
        fetchProfil(); // Exécute la fonction au montage
    }, [accessToken]); // Re-exécute si le token change

    // ── Gère la modification d'un champ du formulaire ─────────────────────────
    const handleChange = (champ, valeur) => {
        // Met à jour la valeur du champ dans l'état profil
        setProfil(prev => ({ ...prev, [champ]: valeur }));
        // Efface l'erreur associée si le champ était en erreur
        if (erreurs[champ]) setErreurs(prev => ({ ...prev, [champ]: '' }));
    };

    // ── Valide le formulaire avant soumission ──────────────────────────────────
    // Vérifie chaque champ et retourne true si tout est valide
    // >>> Ces règles DUPLIQUENT volontairement celles de UpdateProfilData
    //     côté backend (routes/auth.py) — feedback instantané côté client,
    //     mais la vraie sécurité reste la revalidation serveur (le client
    //     peut toujours être contourné via DevTools ou une requête directe).
    const validerFormulaire = () => {
        let n = {}; // Objet d'erreurs vide

        // Validation du nom : obligatoire, pas de chiffres, 2-50 caractères
        if (!profil.nom.trim()) n.nom = 'Le nom est obligatoire';
        else if (/\d/.test(profil.nom)) n.nom = 'Le nom ne doit pas contenir de chiffres';
        else if (profil.nom.trim().length < 2 || profil.nom.trim().length > 50) n.nom = 'Entre 2 et 50 caractères';

        // Validation du prénom : mêmes règles que le nom
        if (!profil.prenom.trim()) n.prenom = 'Le prénom est obligatoire';
        else if (/\d/.test(profil.prenom)) n.prenom = 'Le prénom ne doit pas contenir de chiffres';
        else if (profil.prenom.trim().length < 2 || profil.prenom.trim().length > 50) n.prenom = 'Entre 2 et 50 caractères';

        // Validation de l'email : regex standard RFC
        const eR = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!profil.email.trim()) n.email = "L'email est obligatoire";
        else if (!eR.test(profil.email.trim())) n.email = "Format d'email invalide";

        // Validation du numéro : obligatoire, chiffres uniquement, exactement 10
        if (!profil.numero.trim()) n.numero = 'Le numéro est obligatoire';
        else if (!/^\d+$/.test(profil.numero.trim())) n.numero = "Chiffres uniquement";
        else if (profil.numero.trim().length !== 10) n.numero = "Exactement 10 chiffres";

        setErreurs(n); // Met à jour les erreurs dans l'état
        return Object.keys(n).length === 0; // True si aucune erreur
    };

    // ── Soumet le formulaire : valide puis envoie au backend ───────────────────
    // >>> Appelle PUT /api/auth/update-profile (routes/auth.py) — construit
    //     dynamiquement sa requête SQL UPDATE (voir la fonction annotée
    //     précédemment dans auth_ANNOTE.py) pour ne modifier que les champs
    //     réellement fournis.
    const valider = async () => {
        if (!validerFormulaire()) return; // Arrête si validation échoue
        setSaving(true); // Active le spinner de sauvegarde
        try {
            // Envoie les données au endpoint de mise à jour du profil
            const res = await fetch("http://localhost:8000/api/auth/update-profile", {
                method: "PUT", // Méthode PUT pour la mise à jour
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                body: JSON.stringify({ nom: profil.nom, prenom: profil.prenom, email: profil.email, numero: profil.numero })
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Erreur"); } // Erreur HTTP
            setToast(true); // Affiche le toast de confirmation
            setTimeout(() => setToast(false), 2500); // Masque le toast après 2.5s
        } catch (error) { console.error(error); setErreurs({ general: error.message }); } // Erreur générale
        finally { setSaving(false); } // Désactive le spinner
    };

    // ── Calcule les initiales pour l'avatar ───────────────────────────────────
    // Ex: "Rayane Berrada" → "RB"
    // >>> Pas de useMemo() ici — recalculé à chaque rendu, ce qui est
    //     acceptable car l'opération est triviale (accès à 2 caractères +
    //     filtre + join). .filter(Boolean) élimine les valeurs vides/undefined
    //     si prenom ou nom n'est pas encore chargé.
    const initiales = [profil.prenom[0], profil.nom[0]].filter(Boolean).join('').toUpperCase() || '?';

    return (
        <>
            {/* ── Styles CSS intégrés pour la page profil ── */}
            <style>{`
                /* ── Racine de la page : fond sombre, police Geist ── */
                .prof-root {
                    min-height: 100vh; /* Pleine hauteur d'écran */
                    background: #0F172A; /* Fond bleu très sombre */
                    font-family: var(--sans, "DM Sans", sans-serif); /* Police sans-serif */
                }

                /* ── Toast de confirmation (slide in depuis la droite) ── */
                .prof-toast {
                    position: fixed; /* Position fixe en haut à droite */
                    top: 20px; right: 20px;
                    z-index: 999; /* Au-dessus de tout */
                    background: #16A34A; /* Fond vert de succès */
                    color: #fff; /* Texte blanc */
                    border-radius: 10px; /* Coins arrondis */
                    padding: 12px 18px; /* Espacement interne */
                    font-size: 0.875rem; /* Taille de police 14px */
                    font-weight: 600; /* Semi-gras */
                    display: flex; /* Flex pour icône + texte */
                    align-items: center;
                    gap: 8px; /* Espacement icône-texte */
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4); /* Ombre portée */
                    animation: slideIn 0.25s ease both; /* Animation d'entrée */
                }
                /* Animation du toast : glisse depuis la droite */
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(16px); } /* Départ : invisible + décalé */
                    to   { opacity: 1; transform: translateX(0); } /* Arrivée : visible + en place */
                }

                /* ── Conteneur principal centré ── */
                .prof-container {
                    max-width: 560px; /* Largeur max pour formulaire compact */
                    margin: 0 auto; /* Centre horizontalement */
                    padding: 48px 24px 80px; /* Espacement haut/bas */
                    animation: fadeUp 0.3s ease both; /* Animation d'apparition */
                }
                /* Animation d'apparition : glisse vers le haut */
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); } /* Départ : invisible + en bas */
                    to   { opacity: 1; transform: translateY(0); } /* Arrivée : visible + en place */
                }

                /* ── Titre de la page ── */
                .prof-page-title {
                    font-size: 1.6rem; /* Grande taille */
                    font-weight: 700; /* Gras */
                    color: #F1F5F9; /* Texte clair sur fond sombre */
                    letter-spacing: -0.02em; /* Espacement négatif pour compacité */
                    margin: 0 0 6px;
                }
                /* Sous-titre de la page */
                .prof-page-sub {
                    font-size: 0.875rem; /* 14px */
                    color: rgba(255,255,255,0.45); /* Blanc semi-transparent */
                    margin: 0 0 28px;
                }

                /* ── Rangée avatar : cercle d'initiales + nom/email ── */
                .prof-avatar-row {
                    display: flex; /* Layout horizontal */
                    align-items: center;
                    gap: 16px; /* Espacement avatar/texte */
                    padding: 20px 24px;
                    background: rgba(255,255,255,0.05); /* Fond légèrement plus clair */
                    border: 1px solid rgba(255,255,255,0.10); /* Bordure subtile */
                    border-radius: 12px; /* Coins arrondis */
                    margin-bottom: 16px;
                }
                /* Cercle d'avatar avec initiales */
                .prof-avatar {
                    width: 52px; height: 52px; /* Taille fixe */
                    border-radius: 50%; /* Cercle parfait */
                    background: rgba(37,99,235,0.25); /* Fond bleu accent semi-transparent */
                    color: #60A5FA; /* Texte bleu clair */
                    font-size: 1.125rem; font-weight: 700; /* Initiales en gras */
                    display: flex; align-items: center; justify-content: center; /* Centre le texte */
                    flex-shrink: 0; /* Ne rétrécit pas */
                    letter-spacing: -0.02em;
                    border: 1.5px solid rgba(96,165,250,0.35); /* Bordure bleu clair */
                }
                /* Nom affiché à côté de l'avatar */
                .prof-avatar-name {
                    font-size: 0.9375rem; font-weight: 600;
                    color: #F1F5F9; margin: 0 0 3px;
                }
                /* Email affiché sous le nom */
                .prof-avatar-email {
                    font-size: 0.8125rem;
                    color: rgba(255,255,255,0.45); margin: 0;
                }

                /* ── Carte du formulaire ── */
                .prof-card {
                    background: rgba(255,255,255,0.05); /* Fond semi-transparent */
                    border: 1px solid rgba(255,255,255,0.10); /* Bordure subtile */
                    border-radius: 12px; padding: 28px 28px 32px;
                }
                /* Titre de la section dans la carte */
                .prof-card-title {
                    font-size: 0.875rem; font-weight: 600;
                    color: rgba(255,255,255,0.55);
                    margin: 0 0 20px; padding-bottom: 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.08); /* Séparateur */
                    text-transform: uppercase; letter-spacing: 0.06em;
                }

                /* ── Alerte d'erreur générale ── */
                .prof-alert {
                    background: rgba(248,113,113,0.12); /* Fond rouge clair */
                    border: 1px solid rgba(248,113,113,0.25); /* Bordure rouge */
                    color: #FCA5A5; /* Texte rouge clair */
                    padding: 11px 14px; border-radius: 8px;
                    font-size: 0.875rem; font-weight: 500;
                    margin-bottom: 20px;
                    display: flex; align-items: center; gap: 8px; /* Icône + texte */
                }

                /* ── Grille 2 colonnes pour nom/prénom ── */
                .prof-grid {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 16px; margin-bottom: 16px;
                }

                /* ── Champ de saisie individuel ── */
                .prof-field {
                    display: flex; flex-direction: column;
                    margin-bottom: 16px;
                }
                .prof-field:last-of-type { margin-bottom: 0; } /* Pas de marge en bas du dernier */
                /* Label au-dessus du champ */
                .prof-label {
                    font-size: 0.8125rem; font-weight: 600;
                    color: rgba(255,255,255,0.55); margin-bottom: 6px;
                }
                /* Input du formulaire */
                .prof-input {
                    width: 100%; padding: 10px 14px;
                    background: rgba(255,255,255,0.07); /* Fond légèrement plus clair */
                    border: 1.5px solid rgba(255,255,255,0.12); /* Bordure subtile */
                    border-radius: 8px;
                    font-size: 0.9375rem; color: #F1F5F9; /* Texte clair */
                    font-family: inherit; outline: none;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease; /* Transitions focus */
                    box-sizing: border-box;
                }
                .prof-input::placeholder { color: rgba(255,255,255,0.25); } /* Placeholder très transparent */
                .prof-input:focus {
                    border-color: #2563EB; /* Bordure bleue au focus */
                    box-shadow: 0 0 0 3px rgba(37,99,235,0.20); /* Halo bleu */
                }
                /* Input en erreur : bordure rouge */
                .prof-input.prof-err { border-color: #F87171 !important; }
                .prof-input.prof-err:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.18); } /* Halo rouge */
                /* Message d'erreur sous le champ */
                .prof-field-error {
                    font-size: 0.75rem; color: #FCA5A5;
                    font-weight: 500; margin: 5px 0 0;
                }

                /* ── Bouton de soumission ── */
                .prof-submit {
                    width: 100%; background: #2563EB; /* Fond bleu accent */
                    color: #fff; border: none;
                    border-radius: 9px; padding: 12px;
                    font-size: 0.9375rem; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    margin-top: 24px;
                    display: flex; align-items: center;
                    justify-content: center; gap: 8px; /* Centré avec icône */
                    transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
                }
                .prof-submit:hover:not(:disabled) { background: #1D4ED8; } /* Hover : bleu plus foncé */
                .prof-submit:active:not(:disabled) { transform: scale(0.985); } /* Clic : légère réduction */
                .prof-submit:disabled { opacity: 0.55; cursor: not-allowed; } /* Désactivé : opacity réduite */

                /* ── Spinner dans le bouton ── */
                .prof-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid rgba(255,255,255,0.3); /* Bordure semi-transparente */
                    border-top-color: #fff; /* Bordure du haut blanche (crée l'effet de rotation) */
                    border-radius: 50%; /* Cercle */
                    animation: spin 0.7s linear infinite; /* Rotation continue */
                }
                @keyframes spin { to { transform: rotate(360deg); } } /* Rotation complète */

                /* ── État de chargement initial ── */
                .prof-loading {
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    gap: 14px; padding: 96px 0; /* Centré verticalement */
                }
                /* Grand spinner de chargement */
                .prof-loading-spinner {
                    width: 32px; height: 32px;
                    border: 3px solid rgba(255,255,255,0.12);
                    border-top-color: #2563EB; /* Haut bleu accent */
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }
                /* Texte "Chargement…" sous le spinner */
                .prof-loading-text {
                    font-size: 0.875rem;
                    color: rgba(255,255,255,0.45);
                }

                /* ── Responsive mobile (< 600px) ── */
                @media (max-width: 600px) {
                    .prof-grid { grid-template-columns: 1fr; } /* Grille en 1 colonne */
                    .prof-container { padding: 32px 16px 64px; } /* Padding réduit */
                    .prof-card { padding: 20px 16px 24px; } /* Padding carte réduit */
                }
            `}</style>

            {/* ── Racine de la page profil ── */}
            <div className="prof-root">
                {/* Barre de navigation (connecté, sans setAccessToken car pas de logout ici) */}
                <Navbar connected accessToken={accessToken} setAccessToken={undefined} />

                {/* ── Toast de confirmation (si visible) ── */}
                {toast && (
                    <div className="prof-toast">
                        {/* Icône SVG de validation (checkmark) */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" /> {/* Chemin du check */}
                        </svg>
                        Profil mis à jour {/* Message de succès */}
                    </div>
                )}

                {/* ── Conteneur principal du formulaire ── */}
                <div className="prof-container">
                    <h1 className="prof-page-title">Mon profil</h1> {/* Titre de la page */}
                    <p className="prof-page-sub">Modifiez vos informations personnelles</p> {/* Description */}

                    {/* ── État de chargement ou formulaire ── */}
                    {loading ? (
                        /* Spinner de chargement initial */
                        <div className="prof-loading">
                            <div className="prof-loading-spinner" />
                            <p className="prof-loading-text">Chargement de votre profil…</p>
                        </div>
                    ) : (
                        <>
                            {/* ── Section avatar avec initiales ── */}
                            <div className="prof-avatar-row">
                                <div className="prof-avatar">{initiales}</div> {/* Cercle avec initiales */}
                                <div>
                                    <p className="prof-avatar-name">
                                        {/* Affiche le nom complet ou placeholder */}
                                        {[profil.prenom, profil.nom].filter(Boolean).join(' ') || 'Votre nom'}
                                    </p>
                                    <p className="prof-avatar-email">{profil.email || 'votre@email.com'}</p>
                                </div>
                            </div>

                            {/* ── Carte du formulaire de modification ── */}
                            <div className="prof-card">
                                <p className="prof-card-title">Informations personnelles</p> {/* Titre de section */}

                                {/* ── Alerte d'erreur générale (si présente) ── */}
                                {erreurs.general && (
                                    <div className="prof-alert">
                                        {/* Icône SVG d'avertissement (cercle avec !) */}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <circle cx="12" cy="12" r="10" /> {/* Cercle */}
                                            <path d="M12 8v4M12 16h.01" /> {/* Point d'exclamation */}
                                        </svg>
                                        {erreurs.general} {/* Message d'erreur */}
                                    </div>
                                )}

                                {/* ── Grille nom + prénom ── */}
                                <div className="prof-grid">
                                    {/* Champ nom */}
                                    <div className="prof-field">
                                        <label className="prof-label">Nom</label>
                                        <input
                                            type="text"
                                            placeholder="Votre nom"
                                            className={`prof-input ${erreurs.nom ? 'prof-err' : ''}`}
                                            value={profil.nom}
                                            onChange={e => handleChange('nom', e.target.value)}
                                        />
                                        {erreurs.nom && <p className="prof-field-error">{erreurs.nom}</p>}
                                    </div>
                                    {/* Champ prénom */}
                                    <div className="prof-field">
                                        <label className="prof-label">Prénom</label>
                                        <input
                                            type="text"
                                            placeholder="Votre prénom"
                                            className={`prof-input ${erreurs.prenom ? 'prof-err' : ''}`}
                                            value={profil.prenom}
                                            onChange={e => handleChange('prenom', e.target.value)}
                                        />
                                        {erreurs.prenom && <p className="prof-field-error">{erreurs.prenom}</p>}
                                    </div>
                                </div>

                                {/* ── Champ email ── */}
                                <div className="prof-field">
                                    <label className="prof-label">Adresse email</label>
                                    <input
                                        type="email"
                                        placeholder="vous@exemple.com"
                                        className={`prof-input ${erreurs.email ? 'prof-err' : ''}`}
                                        value={profil.email}
                                        onChange={e => handleChange('email', e.target.value)}
                                    />
                                    {erreurs.email && <p className="prof-field-error">{erreurs.email}</p>}
                                </div>

                                {/* ── Champ numéro de téléphone ── */}
                                <div className="prof-field">
                                    <label className="prof-label">Numéro de téléphone</label>
                                    <input
                                        type="tel"
                                        placeholder="06 00 00 00 00"
                                        className={`prof-input ${erreurs.numero ? 'prof-err' : ''}`}
                                        value={profil.numero}
                                        onChange={e => handleChange('numero', e.target.value)}
                                    />
                                    {erreurs.numero && <p className="prof-field-error">{erreurs.numero}</p>}
                                </div>

                                {/* ── Bouton de soumission ── */}
                                <button
                                    className="prof-submit"
                                    onClick={valider}
                                    disabled={saving}
                                >
                                    {saving
                                        ? <><span className="prof-spinner" /> Enregistrement…</> /* Spinner + texte */
                                        : 'Enregistrer les modifications' /* Texte normal */
                                    }
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default Page_profil; // Export par défaut du composant