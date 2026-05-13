import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import '../Style/style.css';

export const Connexion = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        motDePasse: ''
    });
    const [erreurs, setErreurs] = useState({});

    const handleChange = (champ, valeur) => {
        setFormData(prev => ({
            ...prev,
            [champ]: valeur
        }));

        if (erreurs[champ]) {
            setErreurs(prev => ({
                ...prev,
                [champ]: ''
            }));
        }
    };

    const validerFormulaire = () => {
        let nouvellesErreurs = {};

        if (!formData.email.trim()) nouvellesErreurs.email = "L'email est obligatoire";
        if (!formData.motDePasse.trim()) nouvellesErreurs.motDePasse = 'Le mot de passe est obligatoire';

        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && !emailRegex.test(formData.email.trim())) {
            nouvellesErreurs.email = "Le format de l'email est invalide.";
        }

        // Validation du mot de passe (mêmes règles que l'inscription)
        if (formData.motDePasse) {
            let pwdErrors = [];
            if (formData.motDePasse.length < 12) pwdErrors.push("12 caractères minimum");
            if (formData.motDePasse.length > 25) pwdErrors.push("25 caractères maximum");
            if (!/[A-Z]/.test(formData.motDePasse)) pwdErrors.push("une majuscule");
            if (!/[a-z]/.test(formData.motDePasse)) pwdErrors.push("une minuscule");
            if (!/\d/.test(formData.motDePasse)) pwdErrors.push("un chiffre");
            if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.motDePasse)) pwdErrors.push("un caractère spécial");

            if (pwdErrors.length > 0) {
                nouvellesErreurs.motDePasse = "Critères requis : " + pwdErrors.join(", ");
            }
        }

        setErreurs(nouvellesErreurs);
        return Object.keys(nouvellesErreurs).length === 0;
    };

    const handleConnexion = async () => {
        if (validerFormulaire()) {
            try {
                const response = await fetch("http://localhost:8000/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        email: formData.email,
                        motDePasse: formData.motDePasse
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    setErreurs({ general: error.detail || "Email ou mot de passe incorrect" });
                    return;
                }

                const data = await response.json();
                sessionStorage.setItem("user", JSON.stringify(data.user));
                sessionStorage.setItem("accessToken", data.accessToken);

                navigate('/dashboard');
            } catch (error) {
                setErreurs({ general: "Impossible de contacter le serveur" });
            }
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-scroll-content">
                <div className="auth-champ-container auth-header-container">
                    <h1 className="auth-title">Connexion</h1>
                    <h2 className="auth-subtitle">Connectez-vous à votre compte</h2>
                </div>

                {erreurs.general && (
                    <div className="auth-alert-error">
                        {erreurs.general}
                    </div>
                )}

                <div className="auth-champ-container">
                    <label className="auth-label">Adresse email</label>
                    <input
                        type="email"
                        placeholder="Entrez votre adresse email"
                        className={`auth-input ${erreurs.email ? 'auth-input-erreur' : ''}`}
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                    />
                    {erreurs.email && <p className="auth-texte-erreur">{erreurs.email}</p>}
                </div>

                <div className="auth-champ-container">
                    <label className="auth-label">Mot de passe</label>
                    <input
                        type="password"
                        placeholder="Entrez votre mot de passe"
                        className={`auth-input ${erreurs.motDePasse ? 'auth-input-erreur' : ''}`}
                        value={formData.motDePasse}
                        onChange={(e) => handleChange('motDePasse', e.target.value)}
                    />
                    {erreurs.motDePasse && <p className="auth-texte-erreur">{erreurs.motDePasse}</p>}
                </div>

                <div className="auth-champ-container mt-4">
                    <button className="auth-bouton" onClick={handleConnexion}>
                        <span className="auth-texte-bouton">Se connecter</span>
                    </button>
                </div>

                <div className="auth-footer">
                    <p className="auth-footer-text">Pas encore de compte ?</p>
                    <button
                        onClick={() => navigate('/inscription')}
                        className="auth-link-bouton"
                    >
                        S'inscrire
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Connexion;