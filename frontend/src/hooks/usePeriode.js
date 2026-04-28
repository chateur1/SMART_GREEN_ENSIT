/**
 * Smart Green ENSIT — Hook période de reporting
 * Récupère la période active depuis le backend (config .env)
 * Fallback : calcul automatique côté frontend si l'API est indisponible
 */
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Cache en mémoire pour éviter les requêtes répétées
let _cache = null;

/**
 * Calcul côté frontend (identique à la logique backend)
 * Calendrier universitaire tunisien : Sept → Août
 */
function calculerPeriodeLocale() {
  const now = new Date();
  const annee = now.getFullYear();
  const mois  = now.getMonth() + 1; // 1-12
  if (mois >= 9) {
    return { periode: `${annee}-${annee + 1}`, annee_debut: annee, annee_fin: annee + 1 };
  }
  return { periode: `${annee - 1}-${annee}`, annee_debut: annee - 1, annee_fin: annee };
}

/**
 * Génère les 5 dernières années universitaires
 * ex: fin=2025 → [2021, 2022, 2023, 2024, 2025]
 */
export function genererHistorique(annee_fin, nb_annees = 5) {
  return Array.from({ length: nb_annees }, (_, i) => annee_fin - nb_annees + 1 + i);
}

/**
 * Hook principal
 * @returns { periode, annee_debut, annee_fin, historique, loading }
 */
export function usePeriode() {
  const [data, setData] = useState(() => {
    // Initialisation immédiate depuis le cache ou calcul local
    if (_cache) return _cache;
    const local = calculerPeriodeLocale();
    return {
      ...local,
      historique: genererHistorique(local.annee_fin),
      campus: null,
      loading: true,
    };
  });

  useEffect(() => {
    if (_cache && !_cache.loading) {
      setData(_cache);
      return;
    }

    // Requête au backend pour la valeur configurée dans .env
    axios.get(`${API_BASE.replace('/api', '')}/config/periode`, { timeout: 5000 })
      .then(({ data: res }) => {
        const result = {
          periode:     res.periode,
          annee_debut: res.annee_debut,
          annee_fin:   res.annee_fin,
          historique:  res.historique || genererHistorique(res.annee_fin),
          source:      res.source,
          // Données réelles du campus ENSIT depuis .env backend
          campus:      res.campus || null,
          loading:     false,
        };
        _cache = result;
        setData(result);
      })
      .catch(() => {
        // Fallback silencieux : calcul local si API indisponible
        const local = calculerPeriodeLocale();
        // Données campus par défaut si API indisponible
        const campusDefault = {
          nb_eleves_ingenieurs:  930,
          nb_masteriens:         120,
          nb_doctorants:         250,
          nb_etudiants_total:    1300,
          nb_diplomes_par_an:    250,
          nb_enseignants_permanents: 150,
          nb_enseignants_total:  171,
          corps_a_pct:           32,
          nb_personnel_total:    225,
          nb_techniciens:        10,
          nb_administratifs:     42,
          nb_departements:       6,
          nb_structures_recherche: 7,
          nb_entites_total:      13,
          surface_campus_m2:     11100,
          population_campus_totale: 1525,
        };
        const result = {
          ...local,
          historique: genererHistorique(local.annee_fin),
          source:     'Calcul local (API indisponible)',
          campus:     campusDefault,
          loading:    false,
        };
        _cache = result;
        setData(result);
      });
  }, []);

  return data;
}

/**
 * Retourne juste la période comme string — version simple sans hook
 * Utilise le cache si disponible, sinon calcul local
 */
export function getPeriodeSync() {
  if (_cache) return _cache.periode;
  return calculerPeriodeLocale().periode;
}

export default usePeriode;
