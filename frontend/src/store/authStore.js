/**
 * Smart Green ENSIT — Store d'authentification (Zustand)
 * Gestion centralisée de la session utilisateur
 */
import { create } from 'zustand';
import { auth as authApi } from '../api/client';

const useAuthStore = create((set, get) => ({
  // État
  utilisateur: null,
  token: localStorage.getItem('access_token'),
  chargement: false,
  erreur: null,

  // Connexion
  connexion: async (email, motDePasse) => {
    set({ chargement: true, erreur: null });
    try {
      const { data } = await authApi.connexion(email, motDePasse);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      set({
        token: data.access_token,
        utilisateur: {
          email,
          role: data.role,
          nomComplet: data.nom_complet,
        },
        chargement: false,
      });
      return data;
    } catch (err) {
      const message = err.response?.data?.detail || 'Erreur de connexion';
      set({ erreur: message, chargement: false });
      throw err;
    }
  },

  // Déconnexion
  deconnexion: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ utilisateur: null, token: null, erreur: null });
  },

  // Chargement du profil au démarrage
  chargerProfil: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const { data } = await authApi.profil();
      set({
        utilisateur: {
          email: data.email,
          role: data.role,
          nomComplet: data.nom_complet,
        },
        token,
      });
    } catch {
      localStorage.removeItem('access_token');
      set({ utilisateur: null, token: null });
    }
  },

  // Accesseurs de rôle
  estAdmin: () => get().utilisateur?.role === 'admin',
  estGestionnaire: () => ['admin', 'manager'].includes(get().utilisateur?.role),
  estConnecte: () => !!get().token,

  // Effacer l'erreur
  effacerErreur: () => set({ erreur: null }),
}));

export default useAuthStore;
