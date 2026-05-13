import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import '../Style/style.css';

export const Dashboard = () => {
    const navigate = useNavigate();
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    const token = sessionStorage.getItem("accessToken");
    const [showUserData, setShowUserData] = useState(true);
    
    useEffect(() => {
        // Vérification au chargement
        if (!user || !token) {
            navigate('/connexion');
            return;
        }

        // Fonction pour vérifier l'expiration
        const checkTokenExpiration = () => {
            const currentToken = sessionStorage.getItem("accessToken");
            const currentUser = sessionStorage.getItem("user");
            
            if (!currentUser || !currentToken) {
                navigate('/connexion');
                return;
            }

            // Vérifie si le token est expiré
            try {
                const payload = JSON.parse(atob(currentToken.split('.')[1]));
                const exp = payload.exp;
                const now = Math.floor(Date.now() / 1000);
                
                if (exp < now) {
                    // Access token expiré (après 1 minute) : cache les données mais reste sur page
                    setShowUserData(false);
                } else {
                    // Access token valide : montre les données
                    setShowUserData(true);
                }
                
                // Simule la vérification du refresh token (3 minutes)
                // En réalité, le refresh token est dans un cookie HttpOnly, on simule ici
                const tokenIssuedAt = payload.iat;
                const refreshExpiry = tokenIssuedAt + (3 * 60); // 3 minutes après émission
                
                if (now > refreshExpiry) {
                    // Refresh token expiré : nettoie et redirige
                    sessionStorage.removeItem("user");
                    sessionStorage.removeItem("accessToken");
                    navigate('/connexion');
                    return;
                }
            } catch (error) {
                // Token invalide, nettoie et redirige
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("accessToken");
                navigate('/connexion');
                return;
            }
        };

        // Vérification immédiate
        checkTokenExpiration();

        // Vérifie toutes les secondes
        const interval = setInterval(checkTokenExpiration, 1000);

        return () => clearInterval(interval);
    }, [navigate]);


    const handleLogout = async () => {
        try {
            // Appel direct à l'API logout
            await fetch("http://localhost:8000/api/auth/logout", {
                method: "POST",
                credentials: "include"
            });
        } catch (error) {
            console.error('Erreur logout:', error);
        } finally {
            // Nettoyage local
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("accessToken");
            navigate('/connexion');
        }
    };


    
    return (
        <div className="auth-container">
            <div className="auth-scroll-content">
                <div className="auth-champ-container auth-header-container">
                    <h1 className="auth-title">Dashboard</h1>
                    <h2 className="auth-subtitle">Bienvenue {user?.nom || 'Utilisateur'}!</h2>
                </div>

                <div className="auth-champ-container">
                    <h3>Vos informations</h3>
                    {showUserData && user ? (
                        <div>
                            <p><strong>ID:</strong> {user.id}</p>
                            <p><strong>Nom:</strong> {user.nom}</p>
                            <p><strong>Prénom:</strong> {user.prenom}</p>
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: '#64748b' }}>Vos données ne sont plus disponibles (token expiré)</p>
                        </div>
                    )}
                </div>

                <div className="auth-champ-container mt-4">
                    <button className="auth-bouton" onClick={handleLogout} style={{ backgroundColor: '#ef4444' }}>
                        Déconnexion
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
