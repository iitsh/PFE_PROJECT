// Importe les hooks React pour la gestion d'état et les effets
import { useState, useEffect } from 'react';
// Importe les composants de routage React Router pour la navigation
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// Importe la page d'inscription
import Inscription from './Screen/Page_inscription';
// Importe la page de connexion
import Connexion   from './Screen/Page_connexion';
// Importe la page d'accueil (landing page après connexion)
import Page_accueil from './Screen/Page_accueil';
// Importe la page d'import de CV PDF
import Page_import_cv from './Screen/Page_import_cv';
// Importe la page de création de nouveau CV (workflow complet)
import Page_nouveau_cv from './Screen/Page_nouveau_cv';
// Importe la page de profil utilisateur
import Page_profil from './Screen/Page_profil';
// Importe la page d'historique des CV générés
import Page_historique from './Screen/Page_historique';
// Importe les styles CSS spécifiques à l'application
import './App.css';

// ── Composant racine de l'application ────────────────────────────────────────
function App() {
  // État : token JWT d'accès (null = non connecté)
  // >>> useState(null) = crée une variable d'état React. Contrairement à
  //     localStorage, cette valeur vit en MÉMOIRE JavaScript uniquement —
  //     elle disparaît au F5 (protection XSS : un script malveillant ne
  //     peut pas lire la mémoire React). C'est pour ça que restore-session
  //     existe : régénérer ce token après chaque rechargement de page.
  const [accessToken, setAccessToken] = useState(null);
  // État : indique si la vérification de session est en cours
  // >>> Empêche un flash de la page de connexion pendant la vérification —
  //     sans ce booléen, l'utilisateur verrait /connexion une fraction de
  //     seconde avant d'être redirigé vers /accueil.
  const [loadingSession, setLoadingSession] = useState(true);

  // ── Effet au montage : restaure la session depuis le cookie refresh token ──
  // >>> useEffect(fn, []) = exécute fn UNE SEULE FOIS, après le 1er rendu.
  //     Le tableau vide [] signifie "aucune dépendance" → jamais ré-exécuté.
  //     C'est l'équivalent de componentDidMount() en classes React.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Appelle l'endpoint de restauration qui lit le cookie refresh token
        // >>> credentials: "include" = OBLIGATOIRE pour que le navigateur
        //     transmette le cookie refreshToken dans cette requête cross-origin
        //     (localhost:5173 → localhost:8000). Sans ça, le cookie ne part
        //     jamais et restore-session retourne toujours 401.
        const res = await fetch("http://localhost:8000/api/auth/restore-session", { credentials: "include" });
        if (res.ok) {
          // Si le refresh token est valide, récupère le nouvel access token
          const data = await res.json();
          setAccessToken(data.accessToken);
        }
      } catch (e) {
        // Erreur réseau ou serveur → log dans la console
        console.error("Erreur restore session", e);
      } finally {
        // >>> finally = s'exécute TOUJOURS, que la requête réussisse ou échoue.
        //     Garantit que loadingSession passe à false dans tous les cas,
        //     évitant un écran de chargement infini si le serveur est down.
        setLoadingSession(false);
      }
    };
    // Lance la restauration au montage du composant
    restoreSession();
  }, []); // Tableau vide = exécuté une seule fois au montage

  // ── Affiche un écran de chargement pendant la vérification de session ──────
  if (loadingSession) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>Vérification de la session...</div>;
  }

  // ── Rendu du routeur avec toutes les routes de l'application ───────────────
  return (
    // Router : enveloppe toute l'application pour la navigation côté client
    // >>> BrowserRouter = utilise l'API History du navigateur pour changer
    //     l'URL sans recharger la page (SPA = Single Page Application).
    //     Il n'y a qu'un seul fichier HTML (index.html) — React gère tous
    //     les changements de "page" en JavaScript, sans aller-retour serveur.
    <Router>
      <Routes>
        {/* Route racine "/" redirige vers la page de connexion */}
        <Route path="/"           element={<Navigate to="/connexion" />} />
        {/* Page de connexion (pas besoin d'être connecté) */}
        <Route path="/connexion"  element={<Connexion  setAccessToken={setAccessToken} />} />
        {/* Page d'inscription (pas besoin d'être connecté) */}
        <Route path="/inscription" element={<Inscription />} />
        {/* Page d'accueil (protégée : redirige vers connexion si pas de token) */}
        {/* >>> accessToken ? <Page> : <Navigate to="/connexion" /> = ROUTE GUARD
                Si accessToken est null (non connecté), React Router redirige
                immédiatement vers /connexion. Si accessToken existe, affiche
                la page. C'est le mécanisme de protection des routes privées.
                setAccessToken est passé en prop pour que les pages puissent
                mettre le token à jour (renouvellement) ou le vider (logout). */}
        <Route path="/accueil"    element={accessToken ? <Page_accueil accessToken={accessToken} setAccessToken={setAccessToken} /> : <Navigate to="/connexion" />} />
        {/* Page d'import CV (protégée) */}
        <Route path="/import-cv"  element={accessToken ? <Page_import_cv accessToken={accessToken} setAccessToken={setAccessToken} /> : <Navigate to="/connexion" />} />
        {/* Page profil (protégée) */}
        <Route path="/profil"     element={accessToken ? <Page_profil accessToken={accessToken} setAccessToken={setAccessToken} /> : <Navigate to="/connexion" />} />
        {/* Page nouveau CV avec workflow complet (protégée) */}
        <Route path="/nouveau-cv" element={accessToken ? <Page_nouveau_cv accessToken={accessToken} setAccessToken={setAccessToken} /> : <Navigate to="/connexion" />} />
        {/* Page historique des CV (protégée) */}
        <Route path="/historique" element={accessToken ? <Page_historique accessToken={accessToken} setAccessToken={setAccessToken} /> : <Navigate to="/connexion" />} />
      </Routes>
    </Router>
  );
}

// Exporte le composant App comme export par défaut
export default App;