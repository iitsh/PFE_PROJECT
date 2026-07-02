/**
 * Tests unitaires pour la page d'accueil (Page_accueil.jsx).
 * Utilise Vitest + React Testing Library avec jsdom.
 * Couvre : affichage du hero et des étapes, compteur de CV générés,
 *          navigation vers /nouveau-cv et /historique, appel API /api/cv/history.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import Page_accueil from '../src/Screen/Page_accueil.jsx';
import { MemoryRouter } from 'react-router-dom';

// Mock global de fetch : empêche les vrais appels réseau vers le backend
global.fetch = vi.fn();

// Mock de useNavigate : permet de vérifier les redirections sans changer l'URL réelle
const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    };
});

let setAccessTokenMock;

beforeAll(() => {
    // Configuration globale avant tous les tests
})

beforeEach(() => {
    vi.clearAllMocks();
    setAccessTokenMock = vi.fn();
})

afterAll(() => {
    vi.restoreAllMocks();
})

describe('Page d\'accueil', () => {
    it('affiche le titre principal et le sous-titre au chargement', () => {
        // Simuler un retour API vide pour l'historique
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        expect(screen.getByText(/Des CV sur mesure/i)).toBeInTheDocument();
        expect(screen.getByText(/générés par IA/i)).toBeInTheDocument();
        expect(screen.getByText(/Importez votre CV existant/i)).toBeInTheDocument();
    });

    it('affiche les deux boutons d\'action principaux', () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        expect(screen.getByRole('button', { name: /Générer un CV/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Historique/i })).toBeInTheDocument();
    });

    it('redirige vers /nouveau-cv quand on clique sur "Générer un CV"', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /Générer un CV/i }));

        expect(mockedNavigate).toHaveBeenCalledWith('/nouveau-cv');
    });

    it('redirige vers /historique quand on clique sur "Historique"', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /Historique/i }));

        expect(mockedNavigate).toHaveBeenCalledWith('/historique');
    });

    it('affiche les 3 étapes du processus', () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        expect(screen.getByText(/Processus en 3 étapes/i)).toBeInTheDocument();
        expect(screen.getByText(/Importer votre CV/i)).toBeInTheDocument();
        expect(screen.getByText(/Vérifier le profil/i)).toBeInTheDocument();
        expect(screen.getByText(/Générer un CV sur mesure/i)).toBeInTheDocument();
    });

    it('affiche le compteur de CV générés depuis l\'API', async () => {
        // Simuler 5 CV dans l'historique
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [{}, {}, {}, {}, {}]
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        // Le compteur animé finit par afficher la valeur
        await waitFor(() => {
            expect(screen.getByText('CV générés')).toBeInTheDocument();
        });
    });

    it('appelle l\'API pour récupérer le nombre de CV au chargement', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/cv/history',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer fake-token'
                    })
                })
            );
        });
    });

    it('affiche le bouton "Commencer" dans la section finale', () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        expect(screen.getByText(/Prêt à commencer/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Commencer gratuitement/i })).toBeInTheDocument();
    });

    it('redirige vers /nouveau-cv quand on clique sur "Commencer gratuitement"', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_accueil accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /Commencer gratuitement/i }));

        expect(mockedNavigate).toHaveBeenCalledWith('/nouveau-cv');
    });
});
