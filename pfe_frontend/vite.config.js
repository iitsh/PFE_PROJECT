// Import de la fonction defineConfig de Vite pour typer la configuration
import { defineConfig } from 'vite'
// Import du plugin React pour Vite (support JSX, Fast Refresh, etc.)
import react from '@vitejs/plugin-react'

// Documentation : https://vite.dev/config/
export default defineConfig({
  // Plugins actives : React pour le support JSX et le hot-reload
  plugins: [react()],

  // ── Configuration des tests unitaires (Vitest) ──
  test: {
    globals: true, // Active les API globales (describe, it, expect sans import)
    environment: 'jsdom', // Simule un DOM de navigateur pour les tests React
    setupFiles: './src/setupTests.js', // Fichier de setup exécuté avant chaque test
    include: ['./Test-Frontend/**/*.test.{js,jsx}'], // Pattern des fichiers de test
  },

  // ── Configuration du serveur de développement ──
  server: {
    // En-têtes de sécurité HTTP envoyés avec chaque réponse
    headers: {
      "X-Content-Type-Options": "nosniff", // Empêche le MIME-sniffing
      "X-Frame-Options": "SAMEORIGIN", // Empêche l'embedding dans des iframes externes
      "Referrer-Policy": "strict-origin-when-cross-origin", // Contrôle le Referer header
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()", // Désactive les permissions navigateur
    },
  },
})
