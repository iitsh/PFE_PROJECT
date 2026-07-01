import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import Connexion from '../src/Screen/Page_connexion.jsx';
import { MemoryRouter } from 'react-router-dom';

// Mocker l'API globale fetch pour éviter les vrais appels réseau
global.fetch = vi.fn();

// Mock the useNavigate hook inside react-router-dom
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

describe('Page de connexion', () => {
    it('affiche le formulaire avec tous les champs vides au chargement', () => {
        render(<MemoryRouter><Connexion setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        expect(screen.getByPlaceholderText('vous@exemple.com')).toHaveValue('');
        expect(screen.getByPlaceholderText('••••••••••••')).toHaveValue('');
        expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
    });

    it('Soumission du formulaire de connexion avec les deux champs vides', async () => {
        render(<MemoryRouter><Connexion setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: /se connecter/i }));

        expect(await screen.findByText(/L'email est obligatoire/i)).toBeInTheDocument();
        expect(await screen.findByText(/Le mot de passe est obligatoire/i)).toBeInTheDocument();
    });

    it("affiche une erreur si l'email est invalide", async () => {
        render(<MemoryRouter><Connexion setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText('vous@exemple.com'), 'rhah');
        await user.click(screen.getByRole('button', { name: /se connecter/i }));
        expect(await screen.findByText(/Format d'email invalide/i)).toBeInTheDocument();
    });

    it('ne révèle PAS la politique de mot de passe (sécurité) — accepte tout mdp non vide', async () => {
        // Sur le login, on ne vérifie PAS la longueur/complexité du mdp.
        // Seul le backend valide : un mdp "faible" est envoyé à l'API
        // et le serveur retourne "Email ou mot de passe incorrect".
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ detail: 'Email ou mot de passe incorrect' })
        });

        render(<MemoryRouter><Connexion setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText('vous@exemple.com'), 'test@example.com');
        await user.type(screen.getByPlaceholderText('••••••••••••'), 'abc'); // mdp "faible" accepté côté client
        await user.click(screen.getByRole('button', { name: /se connecter/i }));

        // Aucune erreur de politique de mot de passe ne doit apparaître
        expect(screen.queryByText(/Minimum 12 caractères/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/majuscule/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/chiffre/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/caractère spécial/i)).not.toBeInTheDocument();

        // L'erreur générique du backend s'affiche (pas de fuite d'info)
        expect(await screen.findByText(/Email ou mot de passe incorrect/i)).toBeInTheDocument();
    });

    it('connexion réussie avec bon email et mot de passe', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ accessToken: 'fake-token' })
        });

        render(<MemoryRouter><Connexion setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        await user.type(screen.getByPlaceholderText('vous@exemple.com'), 'test@example.com');
        await user.type(screen.getByPlaceholderText('••••••••••••'), 'MonSuperMot2passe!2025');
        await user.click(screen.getByRole('button', { name: /se connecter/i }));

        // Vérifier que la fonction setAccessToken a bien été appelée avec le token retourné
        await waitFor(() => {
            expect(setAccessTokenMock).toHaveBeenCalledWith('fake-token');
        });
        
        // Vérifier que la redirection a bien été effectuée
        expect(mockedNavigate).toHaveBeenCalledWith('/accueil');
    });
    
    it('affiche une erreur si la connexion échoue (mauvais mot de passe)', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ detail: 'Identifiants invalides' })
        });

        render(<MemoryRouter><Connexion setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        await user.type(screen.getByPlaceholderText('vous@exemple.com'), 'test@example.com');
        await user.type(screen.getByPlaceholderText('••••••••••••'), 'MonSuperMot2passe!2025');
        await user.click(screen.getByRole('button', { name: /se connecter/i }));

        // Vérifier que l'erreur s'affiche dans la boîte d'alerte rouge
        expect(await screen.findByText(/Identifiants invalides/i)).toBeInTheDocument();
    });
});
