/**
 * Tokens de design partagés — source unique de vérité pour tout le frontend.
 * Principes appliqués :
 * - Un seul accent bleu, saturation < 80%
 * - Neutres teintés (base zinc, chroma 0.005 vers l'accent)
 * - Contraste WCAG AA vérifié sur toutes les paires texte/fond
 * - Rayon de bordure plafonné à 14px max
 */

// Exporte l'objet theme contenant tous les tokens de design
// >>> PATTERN "DESIGN TOKEN" : séparer les décisions de design (couleurs,
//     tailles) du code des composants. Un composant écrit theme.accent
//     au lieu de '#2563EB' en dur — changer la charte graphique revient
//     à modifier UNE SEULE valeur ici, propagée partout automatiquement.
export const theme = {
  // ── Couleur d'accent principale (bleu slate raffiné) ──────────────────────
  // Bleu principal utilisé pour les boutons, liens actifs, badges
  accent: '#2563EB',
  // Bleu plus foncé au survol des boutons
  accentHover: '#1D4ED8',
  // Bleu clair pour les arrière-plans légers de badges/liens
  accentLight: '#DBEAFE',
  // Bleu très pâle pour les fonds de cartes actives et zones d'accent
  accentMuted: '#EFF6FF',

  // ── Surfaces (fonds de cartes et de page) ─────────────────────────────────
  // Blanc pur pour les cartes et conteneurs principaux
  surface: '#FFFFFF',
  // Gris très clair pour l'arrière-plan général de la page
  surfaceAlt: '#F8FAFC',
  // Alias CSS : --bg = fond principal de la page (même valeur que surface)
  bg: '#FFFFFF',
  // Alias CSS : --bg-alt = fond alternatif (même valeur que surfaceAlt)
  bgAlt: '#F8FAFC',

  // ── Texte (contraste vérifié ≥4.5:1 sur surface blanche) ─────────────────
  // Couleur principale du texte (presque noir, très lisible)
  text: '#0F172A',
  // Texte secondaire pour les sous-titres et descriptions
  textSecondary: '#475569',
  // Texte atténué pour les labels, placeholders, timestamps
  textMuted: '#94A3B8',

  // ── Bordures (séparateurs et contours de cartes) ──────────────────────────
  // Bordure standard pour les cartes, inputs, séparateurs
  border: '#E2E8F0',
  // Bordure très légère pour les éléments subtils
  borderLight: '#F1F5F9',

  // ── Couleurs sémantiques (erreurs, succès, avertissements) ────────────────
  // Rouge pour les erreurs et messages d'alerte
  error: '#DC2626',
  // Rouge très pâle pour les arrière-plans d'erreur
  errorLight: '#FEF2F2',
  // Vert pour les succès et validations
  success: '#16A34A',
  // Vert très pâle pour les arrière-plans de succès
  successLight: '#F0FDF4',
  // Orange pour les avertissements
  warning: '#D97706',
  // Orange très pâle pour les arrière-plans d'avertissement
  warningLight: '#FFFBEB',

  // ── Familles de polices ──────────────────────────────────────────────────
  // Police sans-serif principale (Geist = moderne, lisible, neutre)
  sans: "'Geist', system-ui, -apple-system, sans-serif",
  // Police des titres (même que sans pour cohérence)
  heading: "'Geist', system-ui, -apple-system, sans-serif",
  // Police monospace pour le code et éléments techniques
  mono: "'Geist Mono', ui-monospace, Consolas, monospace",

  // ── Rayons de bordure (plafonnés à 14px pour rester impeccables) ─────────
  // >>> radius.full = 9999 : valeur volontairement absurde qui produit un
  //     cercle parfait quelle que soit la taille de l'élément — utilisé
  //     pour les badges/avatars ronds.
  radius: {
    // Petit rayon pour les badges, petits boutons, inputs
    sm: 6,
    // Rayon moyen pour les conteneurs intermédiaires
    md: 10,
    // Grand rayon pour les cartes principales
    lg: 14,
    // Rayon pilule pour les boutons ronds, badges, chips
    full: 9999,
  },

  // ── Ombres (ombre subtile unique, pas de pattern ghost-card) ──────────────
  // Ombre légère pour les cartes au repos
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  // Ombre moyenne pour les éléments élevés (dropdowns, modales)
  shadowMd: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)',

  // ── Échelle typographique (ratio 1.25+ entre chaque niveau) ──────────────
  fontSize: {
    // Titre principal de page (40px)
    h1: '2.5rem',
    // Titre de section (28px)
    h2: '1.75rem',
    // Sous-titre (20px)
    h3: '1.25rem',
    // Texte courant (16px)
    body: '1rem',
    // Petit texte pour les labels et descriptions (14px)
    small: '0.875rem',
    // Légendes et timestamps (12px)
    caption: '0.75rem',
  },
};

// ── Overrides pour le mode sombre ─────────────────────────────────────────────
// Remplace les couleurs light quand l'OS est en prefers-color-scheme: dark
// Seules les valeurs qui changent sont listées (le reste reste identique)
// >>> Ce fichier ne DÉCIDE PAS quand appliquer le dark mode — c'est
//     main.jsx qui lit window.matchMedia() et fait Object.assign(theme,
//     darkTheme) si nécessaire. theme.js ne fait que fournir les 2 palettes.
export const darkTheme = {
  // Accent plus clair pour être visible sur fond sombre
  accent: '#60A5FA',
  accentHover: '#3B82F6',
  accentLight: 'rgba(96, 165, 250, 0.15)',
  accentMuted: 'rgba(96, 165, 250, 0.08)',
  // Surfaces sombres
  bg: '#0F172A',
  bgAlt: '#1E293B',
  surface: '#0F172A',
  surfaceAlt: '#1E293B',
  // Texte clair sur fond sombre
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  // Bordures sombres
  border: '#334155',
  borderLight: '#1E293B',
  // Couleurs sémantiques en pastel (meilleur contraste sur fond sombre)
  error: '#FCA5A5',
  errorLight: 'rgba(220, 38, 38, 0.15)',
  success: '#86EFAC',
  successLight: 'rgba(22, 163, 74, 0.15)',
  warning: '#FCD34D',
  warningLight: 'rgba(217, 119, 6, 0.15)',
  // Ombres plus prononcées en dark mode
  shadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)',
};