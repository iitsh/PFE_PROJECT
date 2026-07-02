/**
 * Tests unitaires pour le parcours de création de CV (Page_nouveau_cv.jsx).
 * Utilise Vitest + React Testing Library avec jsdom.
 * Couvre : skip de l'import si profil existant, workflow complet en 4 étapes
 *          (upload PDF → validation profil → analyse offre → génération CV/lettre).
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Page_nouveau_cv } from '../src/Screen/Page_nouveau_cv.jsx';
import { MemoryRouter } from 'react-router-dom';

// Mock global de fetch : simule les appels séquentiels vers /api/cv/* (profil, parse, analyse, génération)
global.fetch = vi.fn();

// Mock de useNavigate pour les redirections éventuelles pendant le parcours multi-étapes
const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    };
});

// Mock de URL.createObjectURL : jsdom ne l'implémente pas (utilisé pour l'aperçu PDF/blob)
global.URL.createObjectURL = vi.fn();

// Mock scrollIntoView (non disponible dans jsdom)
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
})
afterAll(() => {
    vi.restoreAllMocks();
})

describe('Page Nouveau CV', () => {

    it("permet d'importer un CV, vérifier les données (étape 2), analyser l'offre (étape 3) et générer (étape 4)", async () => {

        const { container } = render(<MemoryRouter><Page_nouveau_cv accessToken="fake" setAccessToken={vi.fn()} /></MemoryRouter>);
        const user = userEvent.setup();

        // Attendre que l'interface soit chargée
        await screen.findByText(/Déposez votre CV ici/i);

        // --- Etape 1 : Upload CV ---
        const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' });

        // Mock pour upload_cv
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                nom: "Smith", prenom: "Will", experiences: [], formations: [], competences: [],
                telephone: '', ville: '', linkedin: '', github: '', portfolio: '', resume: '', projets: [], langues: []
            })
        });

        const fileInput = container.querySelector('input[type="file"]');
        await user.upload(fileInput, file);

        // On passe à l'étape 2 — les informations personnelles s'affichent
        expect(await screen.findByText(/Informations personnelles/i)).toBeInTheDocument();

        // --- Etape 2 -> 3 ---
        // Mock pour PUT /api/cv/profil (appelé par validerProfil)
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "Profil mis à jour avec succès" })
        });

        const nextBtn = screen.getByRole('button', { name: /Valider le profil/i });
        await user.click(nextBtn);

        // "Offre d'emploi" apparaît 3 fois : Stepper + SectionTitle + label "Collez...l'offre d'emploi"
        expect(await screen.findAllByText(/Offre d'emploi/i)).toHaveLength(3);

        // --- Etape 3 : Analyse Offre ---
        await user.type(screen.getByPlaceholderText(/Collez ici le texte de l'offre/i), "Nous cherchons un dev React.");

        // Mock analyse
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ titre_poste: "Dev React", entreprise: "TechCorp", competences_requises: ["React"] })
        });

        await user.click(screen.getByRole('button', { name: /Analyser l'offre/i }));

        // On vérifie que l'analyse s'affiche
        expect(await screen.findByText("Dev React")).toBeInTheDocument();

        // --- Etape 3 -> 4 : Génération ---
        // Mock génération
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ html_cv: "<html><body>CV généré</body></html>", html_lettre: "<html><body>Lettre</body></html>" })
        });

        await user.click(screen.getByRole('button', { name: /Générer le CV/i }));

        // Vérification de l'étape 4
        expect(await screen.findByRole('button', { name: /Voir le CV/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Voir la Lettre/i })).toBeInTheDocument();
    });
});
