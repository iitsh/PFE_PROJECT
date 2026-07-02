/**
 * Tests unitaires pour la page d'inscription (Page_inscription.jsx).
 * Utilise Vitest + React Testing Library avec jsdom.
 * Couvre : validation des champs obligatoires, règles nom/prénom sans chiffres,
 *          confirmation du mot de passe, inscription réussie → /connexion.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import Inscription from '../src/Screen/Page_inscription.jsx';
import { MemoryRouter } from 'react-router-dom';

// Mock global de fetch : simule la réponse de POST /api/auth/register
global.fetch = vi.fn();

// Mock de useNavigate pour vérifier la redirection après inscription réussie
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

describe("Page d'inscription", () => {
    it('affiche le formulaire avec tous les champs vides', () => {
        render(<MemoryRouter><Inscription /></MemoryRouter>);
        expect(screen.getByPlaceholderText('Dupont')).toHaveValue('');
        expect(screen.getByPlaceholderText('Jean')).toHaveValue('');
        expect(screen.getByPlaceholderText('0612345678')).toHaveValue('');
        expect(screen.getByPlaceholderText('vous@exemple.com')).toHaveValue('');
        expect(screen.getAllByPlaceholderText('••••••••••••')).toHaveLength(2); // mdp et confirmation
        expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeInTheDocument();
    });

    it('Soumission avec tous les champs vides', async () => {
        render(<MemoryRouter><Inscription /></MemoryRouter>);
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));

        expect(await screen.findByText(/Le nom est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le prénom est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le numéro est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/L'email est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le mot de passe est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Confirmation obligatoire/i)).toBeInTheDocument();
    });

    it('affiche une erreur si le nom ou prénom contient des chiffres', async () => {
        render(<MemoryRouter><Inscription /></MemoryRouter>);
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText('Dupont'), 'Dupont123');
        await user.type(screen.getByPlaceholderText('Jean'), 'J3an');
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));
        
        expect(await screen.findByText(/Le nom ne doit pas contenir de chiffres/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le prénom ne doit pas contenir de chiffres/i)).toBeInTheDocument();
    });

    it('affiche une erreur si les mots de passe ne correspondent pas', async () => {
        render(<MemoryRouter><Inscription /></MemoryRouter>);
        const user = userEvent.setup();
        const pwInputs = screen.getAllByPlaceholderText('••••••••••••');
        
        await user.type(pwInputs[0], 'MonSuperMot2passe!');
        await user.type(pwInputs[1], 'UnAutreMotDePasse!');
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));
        
        expect(await screen.findByText(/Les mots de passe ne correspondent pas/i)).toBeInTheDocument();
    });

    it('inscription réussie avec redirection vers connexion', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "Inscription réussie" })
        });

        render(<MemoryRouter><Inscription /></MemoryRouter>);
        const user = userEvent.setup();

        await user.type(screen.getByPlaceholderText('Dupont'), 'Doe');
        await user.type(screen.getByPlaceholderText('Jean'), 'John');
        await user.type(screen.getByPlaceholderText('0612345678'), '0612345678');
        await user.type(screen.getByPlaceholderText('vous@exemple.com'), 'john@example.com');
        
        const pwInputs = screen.getAllByPlaceholderText('••••••••••••');
        await user.type(pwInputs[0], 'MonSuperMot2passe!2025');
        await user.type(pwInputs[1], 'MonSuperMot2passe!2025');
        
        await user.click(screen.getByRole('button', { name: /créer mon compte/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/auth/register',
                expect.objectContaining({ method: 'POST' })
            );
        });

        // Vérifie la navigation vers /connexion
        expect(mockedNavigate).toHaveBeenCalledWith('/connexion');
    });
});
