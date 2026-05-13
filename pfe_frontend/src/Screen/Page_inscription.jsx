import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import '../Style/style.css';

export const Inscription = () => {
    const navigate = useNavigate();

    // Same state structure as React Native version
    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        email: '',
        motDePasse: '',
        confirmerMotDePasse: '',
        numero: ''
    });
    const [erreurs, setErreurs] = useState({});

    // Same handleChange pattern as React Native
    const handleChange = (champ, valeur) => {
        setFormData(prev => ({
            ...prev,
            [champ]: valeur
        }));

        // Efface l'erreur du champ quand l'utilisateur modifie
        if (erreurs[champ]) {
            setErreurs(prev => ({
                ...prev,
                [champ]: ''
            }));
        }
    };

    // Vérification en temps réel de la correspondance des mots de passe
    useEffect(() => {
        if (formData.motDePasse && formData.confirmerMotDePasse) {
            if (formData.motDePasse !== formData.confirmerMotDePasse) {
                setErreurs(prev => ({
                    ...prev,
                    confirmerMotDePasse: 'Les mots de passe ne correspondent pas'
                }));
            } else {
                setErreurs(prev => ({
                    ...prev,
                    confirmerMotDePasse: ''
                }));
            }
        }
    }, [formData.motDePasse, formData.confirmerMotDePasse]);

    // Same validation logic as React Native version
    const validerFormulaire = () => {
        let nouvellesErreurs = {};

        if (!formData.nom.trim()) {
            nouvellesErreurs.nom = 'Le nom est obligatoire';
        } else if (/\d/.test(formData.nom)) {
            nouvellesErreurs.nom = 'Le nom ne doit pas contenir de chiffres';
        }

        if (!formData.prenom.trim()) {
            nouvellesErreurs.prenom = 'Le prénom est obligatoire';
        } else if (/\d/.test(formData.prenom)) {
            nouvellesErreurs.prenom = 'Le prénom ne doit pas contenir de chiffres';
        }

        if (!formData.numero.trim()) nouvellesErreurs.numero = 'Le numéro est obligatoire';
        if (!formData.email.trim()) nouvellesErreurs.email = "L'email est obligatoire";
        if (!formData.motDePasse.trim()) nouvellesErreurs.motDePasse = 'Le mot de passe est obligatoire';
        if (!formData.confirmerMotDePasse.trim()) nouvellesErreurs.confirmerMotDePasse = 'La confirmation du mot de passe est obligatoire';

        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && !emailRegex.test(formData.email.trim())) {
            nouvellesErreurs.email = "Le format de l'email est invalide.";
        }

        // Validation du numéro
        if (formData.numero && !/^\d+$/.test(formData.numero.trim())) {
            nouvellesErreurs.numero = "Le numéro doit contenir uniquement des chiffres";
        } else if (formData.numero && formData.numero.trim().length !== 10) {
            nouvellesErreurs.numero = "Le numéro doit contenir exactement 10 chiffres";
        }

        // Validation du mot de passe
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

    // Same inscription handler as React Native version
    const handleInscription = async () => {
    if (validerFormulaire()) {
        try {
            // Envoie toutes les infos du formulaire au backend
            const response = await fetch("http://localhost:8000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nom: formData.nom,
                    prenom: formData.prenom,
                    email: formData.email,
                    motDePasse: formData.motDePasse,
                    numero: formData.numero
                })
            });

            // Si l'email est déjà utilisé ou autre erreur
            if (!response.ok) {
                const err = await response.json();
                setErreurs({ general: err.detail });
                return;
            }

            // Inscription réussie : on redirige vers la connexion
            await response.json();
            navigate('/connexion');

        } catch (error) {
            setErreurs({ general: "Impossible de contacter le serveur" });
        }
    }
};


    return (
        <div className="auth-container">
            <div className="auth-scroll-content">
                <div className="auth-champ-container auth-header-container">
                    <h1 className="auth-title">Inscription</h1>
                    <h2 className="auth-subtitle">Créez votre compte</h2>
                </div>

                <div className="auth-row-container">
                    <div className="auth-champ-container half-width">
                        <label className="auth-label">Nom</label>
                        <input
                            type="text"
                            placeholder="Entrez votre nom"
                            className={`auth-input ${erreurs.nom ? 'auth-input-erreur' : ''}`}
                            value={formData.nom}
                            onChange={(e) => handleChange('nom', e.target.value)}
                        />
                        {erreurs.nom && <p className="auth-texte-erreur">{erreurs.nom}</p>}
                    </div>

                    <div className="auth-champ-container half-width">
                        <label className="auth-label">Prénom</label>
                        <input
                            type="text"
                            placeholder="Entrez votre prénom"
                            className={`auth-input ${erreurs.prenom ? 'auth-input-erreur' : ''}`}
                            value={formData.prenom}
                            onChange={(e) => handleChange('prenom', e.target.value)}
                        />
                        {erreurs.prenom && <p className="auth-texte-erreur">{erreurs.prenom}</p>}
                    </div>
                </div>

                <div className="auth-champ-container">
                    <label className="auth-label">Numéro de téléphone</label>
                    <input
                        type="tel"
                        placeholder="Entrez votre numéro"
                        className={`auth-input ${erreurs.numero ? 'auth-input-erreur' : ''}`}
                        value={formData.numero}
                        onChange={(e) => handleChange('numero', e.target.value)}
                    />
                    {erreurs.numero && <p className="auth-texte-erreur">{erreurs.numero}</p>}
                </div>

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

                <div className="auth-champ-container">
                    <label className="auth-label">Confirmer le mot de passe</label>
                    <input
                        type="password"
                        placeholder="Confirmez votre mot de passe"
                        className={`auth-input ${erreurs.confirmerMotDePasse ? 'auth-input-erreur' : ''}`}
                        value={formData.confirmerMotDePasse}
                        onChange={(e) => handleChange('confirmerMotDePasse', e.target.value)}
                    />
                    {erreurs.confirmerMotDePasse && <p className="auth-texte-erreur">{erreurs.confirmerMotDePasse}</p>}
                </div>

                <div className="auth-champ-container mt-4">
                    <button className="auth-bouton" onClick={handleInscription}>
                        {erreurs.general && <p className="auth-texte-erreur">{erreurs.general}</p>}
                        <span className="auth-texte-bouton">S'inscrire</span>
                    </button>
                </div>

                <div className="auth-footer">
                    <p className="auth-footer-text">Déjà un compte ?</p>
                    <button
                        onClick={() => navigate('/connexion')}
                        className="auth-link-bouton"
                    >
                        Connectez-vous
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Inscription;