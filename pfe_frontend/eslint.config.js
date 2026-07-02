// ══════════════════════════════════════════════════════════════════════════════
//  Configuration ESLint (format "flat config" — ESLint 9+)
//  Analyse statique du code JS/JSX pour détecter erreurs et mauvaises pratiques
//  Lancé via : npm run lint
// ══════════════════════════════════════════════════════════════════════════════

// Règles de base recommandées par ESLint (variables non utilisées, etc.)
import js from '@eslint/js'
// Liste des variables globales selon l'environnement (navigateur, Node, etc.)
import globals from 'globals'
// Vérifie le respect des Rules of Hooks React (useState, useEffect, etc.)
import reactHooks from 'eslint-plugin-react-hooks'
// Empêche d'exporter des composants sans support du Fast Refresh Vite
import reactRefresh from 'eslint-plugin-react-refresh'
// Utilitaires pour définir la config et ignorer des dossiers entiers
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore le dossier dist/ (build de production — code généré, pas à linter)
  globalIgnores(['dist']),

  {
    // S'applique à tous les fichiers JavaScript et JSX du projet
    files: ['**/*.{js,jsx}'],

    // Hérite des presets recommandés (pas besoin de recopier chaque règle)
    extends: [
      js.configs.recommended,              // bonnes pratiques JS générales
      reactHooks.configs.flat.recommended, // hooks React
      reactRefresh.configs.vite,           // compatibilité Vite HMR
    ],

    languageOptions: {
      // Autorise document, window, fetch, etc. (environnement navigateur)
      globals: globals.browser,
      parserOptions: {
        // Active le parsing JSX (<Component />) dans les fichiers .jsx
        ecmaFeatures: { jsx: true },
      },
    },
  },

  {
    // >>> Surcharge pour les tests Vitest : ajoute describe, it, expect, vi, global
    //     (vitest.config dans vite.config.js active aussi globals: true)
    files: ['Test-Frontend/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
  },
])
