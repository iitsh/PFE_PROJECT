import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Page_profil } from '../src/Screen/Page_profil.jsx';
import { MemoryRouter } from 'react-router-dom';

global.fetch = vi.fn();

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockedNavigate,
    };
});

beforeAll(() => {})
beforeEach(() => {
    vi.clearAllMocks();
})
afterAll(() => {
    vi.restoreAllMocks();
})

describe('Page Profil', () => {
    const mockProfileData = {
        nom: 'Doe', prenom: 'John', email: 'john@example.com', numero: '0612345678'
    };

    it('récupère et affiche les informations du profil au chargement', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProfileData
        });

        render(<MemoryRouter><Page_profil accessToken="fake-token" /></MemoryRouter>);
        
        // Au départ on a le spinner
        expect(screen.getByText(/Chargement de votre profil/i)).toBeInTheDocument();

        // Puis les données s'affichent
        await waitFor(() => {
            expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
        });
        
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
        expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('0612345678')).toBeInTheDocument();
    });

    it('affiche des erreurs si on essaye de sauvegarder avec des champs vides', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProfileData
        });

        render(<MemoryRouter><Page_profil accessToken="fake-token" /></MemoryRouter>);
        
        // Attendre le chargement
        await waitFor(() => { expect(screen.getByDisplayValue('Doe')).toBeInTheDocument(); });

        const user = userEvent.setup();
        
        // On vide les champs
        await user.clear(screen.getByDisplayValue('Doe'));
        await user.clear(screen.getByDisplayValue('John'));
        await user.clear(screen.getByDisplayValue('0612345678'));

        await user.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

        expect(await screen.findByText(/Le nom est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le prénom est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le numéro est obligatoire/i)).toBeInTheDocument();
    });

    it('soumet les modifications correctement', async () => {
        // 1. Fetch initial
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProfileData
        });

        render(<MemoryRouter><Page_profil accessToken="fake-token" /></MemoryRouter>);
        await waitFor(() => { expect(screen.getByDisplayValue('Doe')).toBeInTheDocument(); });

        const user = userEvent.setup();

        // On modifie le nom
        const nomInput = screen.getByDisplayValue('Doe');
        await user.clear(nomInput);
        await user.type(nomInput, 'Smith');

        // 2. Mock du PUT
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: 'ok' })
        });

        await user.click(screen.getByRole('button', { name: /enregistrer les modifications/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/auth/update-profile',
                expect.objectContaining({ 
                    method: 'PUT',
                    body: JSON.stringify({
                        nom: 'Smith', prenom: 'John', email: 'john@example.com', numero: '0612345678'
                    })
                })
            );
        });
        
        // Vérifie l'apparition du Toast
        expect(await screen.findByText(/Profil mis à jour/i)).toBeInTheDocument();
    });
});
