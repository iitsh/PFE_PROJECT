/**
 * Tests unitaires pour la barre de navigation (Navbar.jsx).
 * Utilise Vitest + React Testing Library avec jsdom.
 * Couvre : affichage conditionnel selon l'état connecté/déconnecté,
 *          appel API de déconnexion, remise à zéro du token JWT.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import Navbar from '../src/Screen/Navbar.jsx';
import { MemoryRouter } from 'react-router-dom';

// Mock global de fetch : empêche les vrais appels HTTP pendant les tests
global.fetch = vi.fn();

// Mock de setAccessToken passé en prop par App.jsx pour mettre à jour le JWT
let setAccessTokenMock;

beforeAll(() => {})
beforeEach(() => {
    vi.clearAllMocks(); // Réinitialise les compteurs d'appels entre chaque test
    setAccessTokenMock = vi.fn();
})
afterAll(() => {
    vi.restoreAllMocks(); // Restaure fetch et les autres mocks après la suite
})

describe('Navbar', () => {
    it('affiche uniquement le logo si non connecté', () => {
        render(<MemoryRouter><Navbar connected={false} accessToken={null} setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        
        expect(screen.getByText('CVGen')).toBeInTheDocument();
        
        // Les liens de l'espace connecté ne doivent pas être là
        expect(screen.queryByText('Nouveau CV')).not.toBeInTheDocument();
        expect(screen.queryByText('Historique')).not.toBeInTheDocument();
        expect(screen.queryByText('Profil')).not.toBeInTheDocument();
        expect(screen.queryByText('Déconnexion')).not.toBeInTheDocument();
    });

    it('affiche les liens de navigation si connecté', () => {
        render(<MemoryRouter><Navbar connected={true} accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        
        // Les liens spécifiques au bureau (on vérifie le premier qui apparait)
        expect(screen.getAllByText('Nouveau CV')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Historique')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Profil')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Déconnexion')[0]).toBeInTheDocument();
    });

    it('appelle le backend et supprime le token lors de la déconnexion', async () => {
        global.fetch.mockResolvedValueOnce({ ok: true });

        render(<MemoryRouter><Navbar connected={true} accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        // Clique sur le bouton de déconnexion
        await user.click(screen.getAllByText('Déconnexion')[0]);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/auth/logout',
                expect.objectContaining({ method: 'POST' })
            );
        });

        // Vérifie que la fonction setAccessToken a bien été appelée avec null
        expect(setAccessTokenMock).toHaveBeenCalledWith(null);
    });
});
