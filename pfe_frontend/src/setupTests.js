// ══════════════════════════════════════════════════════════════════════════════
//  Configuration globale Vitest — exécutée AVANT chaque fichier de test
//  Référencée dans vite.config.js → test.setupFiles
// ══════════════════════════════════════════════════════════════════════════════
//
// >>> Ce fichier ne contient pas de tests : il prépare l'environnement jsdom
//     pour que les assertions DOM fonctionnent dans Test-Frontend/*.test.jsx.
//
// @testing-library/jest-dom ajoute des matchers personnalisés à expect(), par ex. :
//   - toBeInTheDocument()     → l'élément est présent dans le DOM
//   - toHaveValue('texte')    → la valeur d'un input correspond
//   - toBeVisible()           → l'élément n'est pas masqué (display:none, etc.)
//
// Sans cet import, les tests qui utilisent ces matchers échoueraient avec
// "expect(...).toBeInTheDocument is not a function".
import '@testing-library/jest-dom';
