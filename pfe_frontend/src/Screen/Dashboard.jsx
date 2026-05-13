import { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import '../Style/style.css';

const API = "http://localhost:8000/api/auth";

export const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Appelle /me avec l'access token courant ──────────────────────────
    const fetchMe = useCallback(async (token) => {
        const response = await fetch(`${API}/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        return response;
    }, []);

    // ── Appelle /refresh pour obtenir un nouvel access token ─────────────
    const tryRefresh = useCallback(async () => {
        const response = await fetch(`${API}/refresh`, {
            method: "POST",
            credentials: "include"   // envoie le cookie refreshToken HttpOnly
        });
        if (!response.ok) return null;
        const data = await response.json();
        sessionStorage.setItem("accessToken", data.accessToken);
        return data.accessToken;
    }, []);

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

    // ── Chargement initial : vérifie le token, rafraîchit si besoin ─────
    useEffect(() => {
        const init = async () => {
            const token = sessionStorage.getItem("accessToken");
            if (!token) { navigate('/connexion'); return; }

            // 1. Essaie avec l'access token actuel
            let res = await fetchMe(token);

            // 2. Si expiré (401), tente un refresh automatique
            if (res.status === 401) {
                const newToken = await tryRefresh();
                if (!newToken) {
                    // Refresh token aussi expiré → retour login
                    sessionStorage.removeItem("user");
                    sessionStorage.removeItem("accessToken");
                    navigate('/connexion');
                    return;
                }
                // Réessaie avec le nouveau token
                res = await fetchMe(newToken);
            }

            if (!res.ok) {
                navigate('/connexion');
                return;
            }

            const data = await res.json();
            setUser(data);
            sessionStorage.setItem("user", JSON.stringify(data));
            setLoading(false);
        };

        init();
    }, [navigate, fetchMe, tryRefresh]);


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
                    <h2 className="auth-subtitle">Bienvenue {user?.nom || 'Utilisateur'} !</h2>
                </div>

                <div className="auth-champ-container">
                    <h3>Vos informations</h3>
                    <p><strong>ID :</strong> {user.id}</p>
                    <p><strong>Nom :</strong> {user.nom}</p>
                    <p><strong>Prénom :</strong> {user.prenom}</p>
                    <p><strong>Email :</strong> {user.email}</p>
                </div>

                <div className="auth-champ-container mt-4">
                    <button
                        className="auth-bouton"
                        onClick={handleLogout}
                        style={{ backgroundColor: '#ef4444' }}
                    >
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;