/**
 * Smart Green ENSIT — Client API Axios
 * Attache automatiquement le token JWT à chaque requête
 */
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Intercepteur requête : ajouter le token ────────────
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Intercepteur réponse : gérer les erreurs 401 ───────
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // FIX BUG 8: éviter la boucle infinie sur la route /rafraichir elle-même
    const isRefreshRoute = original?.url?.includes('/auth/rafraichir');

    if (error.response?.status === 401 && !original._retry && !isRefreshRoute) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          // FIX BUG 9: ajouter un timeout sur le refresh
          const { data } = await axios.post(`${API_BASE}/auth/rafraichir`, {
            refresh_token: refreshToken,
          }, { timeout: 10000 });

          localStorage.setItem('access_token', data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return client(original);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('session_expired', '1');
            window.location.href = '/connexion';
          }
          // FIX BUG 8: rejeter l'erreur originale après échec du refresh
          return Promise.reject(refreshError);
        }
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('session_expired', '1');
          window.location.href = '/connexion';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ══════════════════════════════════════════════════════════
// FONCTIONS API PAR MODULE
// ══════════════════════════════════════════════════════════

// ── Authentification ───────────────────────────────────
export const auth = {
  connexion: (email, mot_de_passe) =>
    client.post('/auth/connexion', { email, mot_de_passe }),
  inscription: (email, nom_complet, mot_de_passe) =>
    client.post('/auth/inscription', { email, nom_complet, mot_de_passe, role: 'viewer' }),
  profil: () =>
    client.get('/auth/moi'),
  rafraichir: (refresh_token) =>
    client.post('/auth/rafraichir', { refresh_token }),
  comptesDemo: () =>
    client.get('/auth/comptes-demo'),
};

// ── Bâtiments ─────────────────────────────────────────
export const batiments = {
  lister: () => client.get('/batiments/'),
  detail: (id) => client.get(`/batiments/${id}`),
  entites: () => client.get('/batiments/entites/toutes'),
  resume: () => client.get('/batiments/stats/resume'),
};

// ── Scope 1 ──────────────────────────────────────────
export const scope1 = {
  donnees: () => client.get('/scope1/donnees'),
  saisir: (data) => client.post('/scope1/saisir', data),
  guide: () => client.get('/scope1/guide-saisie'),
};

// ── Scope 2 ──────────────────────────────────────────
export const scope2 = {
  donnees: () => client.get('/scope2/donnees'),
  saisir: (data) => client.post('/scope2/saisir', data),
};

// ── Scope 3 ──────────────────────────────────────────
export const scope3 = {
  donnees: () => client.get('/scope3/donnees'),
  soumettreEnquete: (data) => client.post('/scope3/soumettre-enquete', data),
  formulaire: () => client.get('/scope3/formulaire'),
};

// ── Bilan Carbone ────────────────────────────────────
export const bilan = {
  calculer: (data) => client.post('/bilan/calculer', data),
  simulerScenario: (data) => client.post('/bilan/simuler-scenario', data),
  facteursEmission: () => client.get('/bilan/facteurs-emission'),
};

// ── Intelligence Artificielle ────────────────────────
export const ia = {
  analyseDemo: () => client.get('/ia/demo'),
  analyser: (data) => client.post('/ia/analyser', data),
  tendances: () => client.get('/ia/tendances'),
  previsions: (horizon = 5, modele = 'regression_lineaire') =>
    client.get(`/ia/previsions/${horizon}?modele=${modele}`),
  anomalies: (seuil = 15.0) => client.get(`/ia/anomalies?seuil_pct=${seuil}`),
  recommandations: () => client.get('/ia/recommandations'),
};

// ── Scénarios ────────────────────────────────────────
export const scenarios = {
  lister: () => client.get('/scenarios/'),
  simuler: (data) => client.post('/scenarios/simuler', data),
  presets: () => client.get('/scenarios/presets'),
};

// ── Export ───────────────────────────────────────────
export const exportApi = {
  // periode: utiliser getPeriodeSync() ou valeur du hook usePeriode()
  pdf: (periode = null) =>
    client.get(`/export/pdf${periode ? `?periode=${periode}` : ''}`, { responseType: 'blob' }),
  excel: (periode = null) =>
    client.get(`/export/excel${periode ? `?periode=${periode}` : ''}`, { responseType: 'blob' }),
  formats: () => client.get('/export/formats-disponibles'),
  periodeActive: () => client.get('/config/periode', { baseURL: process.env.REACT_APP_API_URL?.replace('/api','') || 'http://localhost:8000' }),
};

// ── Utilitaire : télécharger un blob ─────────────────
export function telechargerFichier(blob, nomFichier) {
  const url = window.URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  window.URL.revokeObjectURL(url);
}

export default client;
