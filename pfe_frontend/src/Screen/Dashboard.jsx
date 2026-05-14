import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import '../Style/style.css';

const API = "http://localhost:8000/api/auth";

export const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser]               = useState(null);
    const [loading, setLoading]         = useState(true);
    const [accessExpire, setAccessExpire] = useState(false); // access token expiré → cache les données
    const [tempsRestant, setTempsRestant] = useState(0);     // secondes avant déconnexion

    // ── Logout ───────────────────────────────────────────────────────────
    const handleLogout = async () => {
        try {
            await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
        } catch (e) {
            console.error("Erreur logout:", e);
        } finally {
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("accessToken");
            navigate('/connexion');
        }
    };

    // ── Chargement initial ───────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const token = sessionStorage.getItem("accessToken");
            if (!token) { navigate('/connexion'); return; }

            // Appelle /me UNE SEULE FOIS — pas de refresh automatique
            const res = await fetch(`${API}/me`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                // Token déjà invalide ou expiré dès l'arrivée → retour login
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("accessToken");
                navigate('/connexion');
                return;
            }

            const data = await res.json();
            setUser(data);
            sessionStorage.setItem("user", JSON.stringify(data));
            setLoading(false);
        };

        init();
    }, [navigate]);

    // ── Minuterie : surveille l'expiration des tokens ────────────────────
    useEffect(() => {
        if (loading) return; // attend que les données soient chargées

        const token = sessionStorage.getItem("accessToken");
        if (!token) return;

        // Décode le payload JWT (lecture seule, pas de vérification de signature)
        // pour récupérer exp (access token) et calculer l'expiration du refresh token
        let expAccess, expRefresh;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            expAccess  = payload.exp * 1000;                   // ms — expiration access token (1 min)
            expRefresh = expAccess + (2 * 60 * 1000);          // +2 min → 3 min total (refresh token)
        } catch {
            navigate('/connexion');
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();

            if (now >= expRefresh) {
                // ── Refresh token expiré → déconnexion automatique ────────
                clearInterval(interval);
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("accessToken");
                navigate('/connexion');

            } else if (now >= expAccess) {
                // ── Access token expiré → on cache les données ────────────
                // (les données restent en mémoire mais ne sont plus affichées)
                setAccessExpire(true);
                const secondesRestantes = Math.ceil((expRefresh - now) / 1000);
                setTempsRestant(secondesRestantes);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [loading, navigate]);

    // ── Affichage ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="auth-container">
                <p style={{ color: '#64748b', textAlign: 'center' }}>Chargement…</p>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-scroll-content">

                <div className="auth-champ-container auth-header-container">
                    <h1 className="auth-title">Dashboard</h1>
                    {!accessExpire && (
                        <h2 className="auth-subtitle">Bienvenue {user?.nom || 'Utilisateur'} !</h2>
                    )}
                </div>

                {/* ── Access token expiré : données cachées ── */}
                {accessExpire ? (
                    <div className="auth-alert-error" style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                            ⚠️ Votre session a expiré.
                        </p>
                        <p>
                            Déconnexion automatique dans <strong>{tempsRestant}</strong> seconde{tempsRestant > 1 ? 's' : ''}.
                        </p>
                        <button
                            className="auth-bouton"
                            onClick={handleLogout}
                            style={{ marginTop: '12px', backgroundColor: '#ef4444' }}
                        >
                            <span className="auth-texte-bouton">Se déconnecter maintenant</span>
                        </button>
                    </div>

                ) : (
                    /* ── Access token valide : données affichées ── */
                    <div className="auth-champ-container">
                        <h3>Vos informations</h3>
                        <p><strong>ID :</strong> {user.id}</p>
                        <p><strong>Nom :</strong> {user.nom}</p>
                        <p><strong>Prénom :</strong> {user.prenom}</p>
                        <p><strong>Email :</strong> {user.email}</p>
                    </div>
                )}

                {/* ── Bouton déconnexion toujours visible ── */}
                {!accessExpire && (
                    <div className="auth-champ-container mt-4">
                        <button
                            className="auth-bouton"
                            onClick={handleLogout}
                            style={{ backgroundColor: '#ef4444' }}
                        >
                            <span className="auth-texte-bouton">Déconnexion</span>
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Dashboard;