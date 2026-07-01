import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import Page_import_cv from '../src/Screen/Page_import_cv.jsx';
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

describe('Page d\'import de CV', () => {
    it('affiche la zone de dépôt au chargement', () => {
        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        expect(screen.getByText(/Importez votre CV/i)).toBeInTheDocument();
        expect(screen.getByText(/Déposez votre CV ici/i)).toBeInTheDocument();
        expect(screen.getByText(/ou cliquez pour sélectionner un fichier/i)).toBeInTheDocument();
        expect(screen.getByText(/PDF uniquement/i)).toBeInTheDocument();
    });

    it('affiche le header avec le titre et le sous-titre', () => {
        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        expect(screen.getByText(/Import de CV/i)).toBeInTheDocument();
        expect(screen.getByText(/Téléchargez votre CV en PDF/i)).toBeInTheDocument();
    });

    it('ignore les fichiers non-PDF lors du dépôt', () => {
        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        // Simuler un dépôt de fichier non-PDF
        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakeFile = new File(['contenu'], 'document.txt', { type: 'text/plain' });

        // Déclencher l'événement drop avec un fichier non-PDF
        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakeFile] };
        dropzone.dispatchEvent(dropEvent);

        // L'API ne doit pas être appelée
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('appelle l\'API /parse quand un fichier PDF est déposé', async () => {
        const profilMock = {
            prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com',
            telephone: '0612345678', ville: 'Paris', linkedin: '',
            experiences: [], formations: [], competences: [], projets: [], langues: []
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => profilMock
        });

        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        // Simuler un dépôt de fichier PDF
        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakePdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });

        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakePdf] };
        dropzone.dispatchEvent(dropEvent);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:8000/api/cv/parse',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer fake-token'
                    })
                })
            );
        });
    });

    it('affiche les résultats après une analyse réussie', async () => {
        const profilMock = {
            prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com',
            telephone: '0612345678', ville: 'Paris', linkedin: 'linkedin.com/jean',
            experiences: [
                { titre: 'Développeur', entreprise: 'TechCorp', duree: '2 ans', lieu: 'Paris', description: ['React', 'Node'] }
            ],
            formations: [
                { diplome: 'Master Info', etablissement: 'Université Paris', annee: '2020', description: [] }
            ],
            competences: [
                { categorie: 'Langages', elements: ['JavaScript', 'Python'] }
            ],
            projets: [], langues: []
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => profilMock
        });

        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        // Simuler le dépôt d'un PDF
        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakePdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });

        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakePdf] };
        dropzone.dispatchEvent(dropEvent);

        // Attendre que la vue résultats s'affiche
        await waitFor(() => {
            expect(screen.getByText(/CV analysé avec succès/i)).toBeInTheDocument();
        });

        // Vérifier les informations personnelles
        expect(screen.getByText('Jean')).toBeInTheDocument();
        expect(screen.getByText('Dupont')).toBeInTheDocument();
        expect(screen.getByText('jean@test.com')).toBeInTheDocument();

        // Vérifier les expériences
        expect(screen.getByText('Développeur')).toBeInTheDocument();
        expect(screen.getByText(/TechCorp/i)).toBeInTheDocument();

        // Vérifier les compétences
        expect(screen.getByText('JavaScript')).toBeInTheDocument();
        expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('affiche les boutons d\'action après analyse', async () => {
        const profilMock = {
            prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com',
            telephone: '0612345678', ville: 'Paris', linkedin: '',
            experiences: [], formations: [], competences: [], projets: [], langues: []
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => profilMock
        });

        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakePdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakePdf] };
        dropzone.dispatchEvent(dropEvent);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Réimporter/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Générer mon CV/i })).toBeInTheDocument();
        });
    });

    it('redirige vers /nouveau-cv quand on clique sur "Générer mon CV"', async () => {
        const profilMock = {
            prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com',
            telephone: '0612345678', ville: 'Paris', linkedin: '',
            experiences: [], formations: [], competences: [], projets: [], langues: []
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => profilMock
        });

        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        // Déposer un PDF
        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakePdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakePdf] };
        dropzone.dispatchEvent(dropEvent);

        // Attendre les boutons puis cliquer
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Générer mon CV/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Générer mon CV/i }));
        expect(mockedNavigate).toHaveBeenCalledWith('/nouveau-cv');
    });

    it('revient à la vue upload quand on clique sur "Réimporter"', async () => {
        const profilMock = {
            prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com',
            telephone: '0612345678', ville: 'Paris', linkedin: '',
            experiences: [], formations: [], competences: [], projets: [], langues: []
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => profilMock
        });

        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);
        const user = userEvent.setup();

        // Déposer un PDF
        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakePdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakePdf] };
        dropzone.dispatchEvent(dropEvent);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Réimporter/i })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Réimporter/i }));

        // La zone de dépôt doit réapparaître
        expect(screen.getByText(/Déposez votre CV ici/i)).toBeInTheDocument();
    });

    it('affiche une alerte si l\'API retourne une erreur', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ detail: 'Erreur serveur' })
        });

        // Mocker alert pour vérifier qu'il est appelé
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

        render(<MemoryRouter><Page_import_cv accessToken="fake-token" setAccessToken={setAccessTokenMock} /></MemoryRouter>);

        const dropzone = screen.getByText(/Déposez votre CV ici/i).closest('.imp-dropzone');
        const fakePdf = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [fakePdf] };
        dropzone.dispatchEvent(dropEvent);

        await waitFor(() => {
            expect(alertMock).toHaveBeenCalled();
        });

        alertMock.mockRestore();
    });
});
