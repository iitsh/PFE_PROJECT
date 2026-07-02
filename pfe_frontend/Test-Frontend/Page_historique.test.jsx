/**
 * Tests unitaires pour la page historique (Page_historique.jsx).
 * Utilise Vitest + React Testing Library avec jsdom.
 * Couvre : spinner de chargement, liste vide, affichage des CV générés,
 *          ouverture du modal avec aperçu HTML (CV + lettre de motivation).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Page_historique } from '../src/Screen/Page_historique.jsx';
import { MemoryRouter } from 'react-router-dom';

// Mock global de fetch : simule GET /api/cv/history et GET /api/cv/html/{id}
global.fetch = vi.fn();

// Mock de useNavigate (utilisé si déconnexion ou redirection depuis la page)
const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    };
});

let setAccessTokenMock;

beforeAll(() => {})
beforeEach(() => {
    vi.clearAllMocks();
    setAccessTokenMock = vi.fn();
})
afterAll(() => {
    vi.restoreAllMocks();
})

describe('Page Historique', () => {
    it('affiche le spinner de chargement initial', () => {
        // Mock en attente indéfinie pour voir le spinner
        global.fetch.mockImplementationOnce(() => new Promise(() => {}));
        render(<MemoryRouter><Page_historique accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        
        expect(screen.getByText(/Chargement de l'historique/i)).toBeInTheDocument();
    });

    it('affiche un message si aucun CV', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<MemoryRouter><Page_historique accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        
        expect(await screen.findByText(/Aucun CV généré/i)).toBeInTheDocument();
    });

    it('affiche la liste des CVs', async () => {
        const mockData = [
            { id_cv: 1, date_creation: '2026-06-08T10:00:00.000Z', format: 'HTML', contenu_cv: { entreprise_offre: 'Google', titre_offre: 'Développeur Fullstack', prenom: 'John', nom: 'Doe' } }
        ];

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData
        });

        render(<MemoryRouter><Page_historique accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        
        expect(await screen.findByText(/Google — Développeur Fullstack/i)).toBeInTheDocument();
        expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Voir les documents/i })).toBeInTheDocument();
    });

    it('ouvre le modal avec le CV au clic sur "Voir les documents"', async () => {
        const mockData = [
            { id_cv: 1, date_creation: '2026-06-08T10:00:00.000Z', format: 'HTML', contenu_cv: { titre_offre: 'Développeur Fullstack', prenom: 'John', nom: 'Doe' } }
        ];

        // 1er fetch: recup historique
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

        render(<MemoryRouter><Page_historique accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        
        const btnVoir = await screen.findByRole('button', { name: /Voir les documents/i });
        const user = userEvent.setup();

        // 2e fetch: recuperation du html au clic
        global.fetch.mockResolvedValueOnce({ 
            ok: true, 
            json: async () => ({ html_cv: '<html><body>CV HTML</body></html>', html_lettre: '<html><body>Lettre HTML</body></html>' }) 
        });

        await user.click(btnVoir);

        // Verification que le fetch du HTML a été appelé
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/cv/html/1',
                expect.objectContaining({ headers: { Authorization: 'Bearer fake-token' } })
            );
        });

        // Verification du rendu du modal (les boutons onglets sont présents)
        expect(await screen.findByText('Lettre de motivation')).toBeInTheDocument();
    });
});
