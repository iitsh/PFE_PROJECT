// Importe StrictMode de React pour activer les vérifications de développement
import { StrictMode } from 'react'
// Importe createRoot pour monter l'application React dans le DOM
import { createRoot } from 'react-dom/client'
// Importe les styles CSS globaux (reset, typographie — les tokens viennent de theme.js)
import './index.css'
// Importe le thème clair (source unique de vérité) et les overrides dark
import { theme, darkTheme } from './theme'
// Importe le composant racine de l'application
import App from './App.jsx'

// ── Helpers : conversion camelCase → kebab-case pour les noms de variables CSS ──
// >>> Les variables CSS s'écrivent --accent-hover (kebab-case) mais les clés
//     JavaScript s'écrivent accentHover (camelCase). Cette fonction convertit
//     automatiquement l'un en l'autre.
// "accentHover" → "accent-hover", "textSecondary" → "text-secondary"
// >>> str.replace(/([A-Z])/g, '-$1').toLowerCase() : la regex /([A-Z])/g
//     capture chaque lettre majuscule, '-$1' insère un tiret avant elle,
//     toLowerCase() passe tout en minuscule.
const toKebab = (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase()

// ── Génère les variables CSS à partir d'un objet de tokens ─────────────────────
// >>> Transforme { accent: '#2563EB', radius: { sm: 6 } } en la chaîne
//     CSS "  --accent: #2563EB;\n  --radius-sm: 6;\n"
//     qui sera injectée dans un <style> dans le <head>.
// >>> Object.entries(obj) = retourne un tableau de paires [clé, valeur]
//     pour chaque propriété de l'objet — permet de boucler dessus avec
//     for...of et la déstructuration [key, value].
function buildCSSVars(tokens) {
  let vars = ''
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value === 'string') {
      // Token simple : theme.accent → --accent
      vars += `  --${toKebab(key)}: ${value};\n`
    } else if (typeof value === 'object' && key !== 'fontSize') {
      // Objet imbriqué (radius, shadow) : theme.radius.sm → --radius-sm
      for (const [sub, v] of Object.entries(value)) {
        vars += `  --${toKebab(key)}-${sub}: ${v};\n`
      }
    }
  }
  // Mappe les tailles de police : theme.fontSize.h1 → --fs-h1
  if (tokens.fontSize) {
    for (const [key, value] of Object.entries(tokens.fontSize)) {
      vars += `  --fs-${key}: ${value};\n`
    }
  }
  return vars
}

// ── Détecte le mode sombre de l'OS ─────────────────────────────────────────────
// >>> window.matchMedia('(prefers-color-scheme: dark)') = lit la préférence
//     système de l'utilisateur (macOS/Windows/Android). Retourne un objet
//     MediaQueryList avec .matches (boolean) et .addEventListener() pour
//     écouter les changements en temps réel.
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)')

// ── Applique le bon thème selon le mode détecté ────────────────────────────────
// Fusionne theme (light) + darkTheme (overrides) si dark mode actif
function applyTheme() {
  // Base : toujours les tokens light
  const activeTokens = { ...theme }   // spread = copie superficielle de l'objet
  // Si l'OS est en dark mode, on remplace par les overrides sombres
  // >>> Object.assign(cible, source) = copie les propriétés de source dans
  //     cible en les ÉCRASANT si elles existent déjà. Ici, darkTheme ne
  //     contient que les tokens qui changent en dark mode (pas tous les tokens).
  if (darkMQ.matches) {
    Object.assign(activeTokens, darkTheme)
  }
  // Génère le CSS et l'injecte dans <head>
  styleEl.textContent = `:root {\n${buildCSSVars(activeTokens)}}`
}

// ── Crée la balise <style> pour les variables CSS ──────────────────────────────
// >>> document.createElement('style') = crée un élément HTML <style> en
//     mémoire. document.head.appendChild() l'ajoute dans le <head> du
//     document — toutes les variables CSS --accent etc. seront disponibles
//     dans tout le document à partir de maintenant.
const styleEl = document.createElement('style')
document.head.appendChild(styleEl)

// ── Applique le thème au chargement et écoute les changements de préférence ──
applyTheme()
// Si l'utilisateur change le thème de son OS pendant l'utilisation de l'app
darkMQ.addEventListener('change', applyTheme)

// ── Crée la racine React et la monte dans l'élément #root du HTML ──
// >>> createRoot() = API React 18 (remplace ReactDOM.render de React 17).
//     document.getElementById('root') = trouve le <div id="root"> dans
//     index.html — la DIV vide dans laquelle React va injecter toute l'UI.
//     .render() = déclenche le premier rendu, React prend le contrôle de ce div.
createRoot(document.getElementById('root')).render(
  // StrictMode active les warnings et vérifications supplémentaires en développement
  // >>> En production (npm run build), StrictMode est ignoré automatiquement.
  //     En dev, il appelle chaque composant 2 fois pour détecter les
  //     effets de bord non intentionnels.
  <StrictMode>
    {/* Rendu du composant App (contient le routeur et toutes les pages) */}
    <App />
  </StrictMode>,
)