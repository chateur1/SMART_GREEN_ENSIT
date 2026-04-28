"""
Smart Green ENSIT — Routeur Bâtiments & Entités
Structure organisationnelle réelle du campus ENSIT
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.securite import get_utilisateur_actuel, require_manager_ou_admin, TokenData
from app.core.config import settings

router = APIRouter()


# ── Schémas ────────────────────────────────────────────────────
class BatimentSchema(BaseModel):
    id: str
    nom: str
    code: str
    type_batiment: str
    surface_m2: Optional[float] = None
    nb_etages: Optional[int] = None
    est_actif: bool = True

class BatimentCreate(BaseModel):
    nom: str
    code: str
    type_batiment: str
    surface_m2: Optional[float] = None
    nb_etages: Optional[int] = None

class EntiteSchema(BaseModel):
    id: str
    nom: str
    code: str
    type_entite: str
    batiment_id: Optional[str] = None
    batiment_nom: Optional[str] = None
    nb_personnes: Optional[int] = None


# ── Données réelles ENSIT ──────────────────────────────────────
BATIMENTS_DEMO = [
    {"id": "b1", "nom": "Bâtiment Principal A",       "code": "PRIN-A",  "type_batiment": "pedagogique",   "surface_m2": 4500, "nb_etages": 4, "est_actif": True},
    {"id": "b2", "nom": "Laboratoire Génie Civil",     "code": "LAB-GC",  "type_batiment": "laboratoire",   "surface_m2": 1800, "nb_etages": 2, "est_actif": True},
    {"id": "b3", "nom": "Bâtiment Administratif",      "code": "ADMIN",   "type_batiment": "administratif", "surface_m2": 1200, "nb_etages": 3, "est_actif": True},
    {"id": "b4", "nom": "Labo Informatique & IA",      "code": "LAB-IA",  "type_batiment": "laboratoire",   "surface_m2": 900,  "nb_etages": 1, "est_actif": True},
    {"id": "b5", "nom": "Amphithéâtres (A1, A2, A3)",  "code": "AMPHI",   "type_batiment": "pedagogique",   "surface_m2": 2100, "nb_etages": 2, "est_actif": True},
    {"id": "b6", "nom": "Atelier Technique",            "code": "ATEL",    "type_batiment": "technique",     "surface_m2": 600,  "nb_etages": 1, "est_actif": True},
]

# ── 6 Départements d'enseignement + 7 Structures de recherche ──
ENTITES_DEMO = [
    # ─ Départements d'enseignement (6) ──────────────────────
    {"id": "d1", "nom": "Département Génie Civil",             "code": "GC",    "type_entite": "departement",
     "batiment_id": "b1", "batiment_nom": "Bâtiment Principal A",    "nb_personnes": 165},
    {"id": "d2", "nom": "Département Génie Mécanique",         "code": "GM",    "type_entite": "departement",
     "batiment_id": "b1", "batiment_nom": "Bâtiment Principal A",    "nb_personnes": 155},
    {"id": "d3", "nom": "Département Génie Électrique",        "code": "GEL",   "type_entite": "departement",
     "batiment_id": "b1", "batiment_nom": "Bâtiment Principal A",    "nb_personnes": 145},
    {"id": "d4", "nom": "Département Informatique & Réseaux",  "code": "INFO",  "type_entite": "departement",
     "batiment_id": "b4", "batiment_nom": "Labo Informatique & IA",  "nb_personnes": 135},
    {"id": "d5", "nom": "Département Sciences de Base",        "code": "SB",    "type_entite": "departement",
     "batiment_id": "b1", "batiment_nom": "Bâtiment Principal A",    "nb_personnes": 120},
    {"id": "d6", "nom": "Département Sciences Humaines",       "code": "SHS",   "type_entite": "departement",
     "batiment_id": "b3", "batiment_nom": "Bâtiment Administratif",  "nb_personnes": 80},
    # ─ Structures de recherche (7) ──────────────────────────
    {"id": "r1", "nom": "Labo Matériaux, Optimisation & Modélisation",  "code": "MOM",   "type_entite": "recherche",
     "batiment_id": "b2", "batiment_nom": "Laboratoire Génie Civil",   "nb_personnes": 35},
    {"id": "r2", "nom": "Labo Mécanique Appliquée",                     "code": "LMA",   "type_entite": "recherche",
     "batiment_id": "b2", "batiment_nom": "Laboratoire Génie Civil",   "nb_personnes": 30},
    {"id": "r3", "nom": "Labo Systèmes Électriques & Environnement",    "code": "SEE",   "type_entite": "recherche",
     "batiment_id": "b4", "batiment_nom": "Labo Informatique & IA",    "nb_personnes": 32},
    {"id": "r4", "nom": "Labo Informatique, Signaux & Images",          "code": "ISI",   "type_entite": "recherche",
     "batiment_id": "b4", "batiment_nom": "Labo Informatique & IA",    "nb_personnes": 28},
    {"id": "r5", "nom": "Labo Génie des Procédés & Environnement",      "code": "GPE",   "type_entite": "recherche",
     "batiment_id": "b6", "batiment_nom": "Atelier Technique",          "nb_personnes": 25},
    {"id": "r6", "nom": "Labo Thermique & Énergétique",                 "code": "LTE",   "type_entite": "recherche",
     "batiment_id": "b6", "batiment_nom": "Atelier Technique",          "nb_personnes": 22},
    {"id": "r7", "nom": "Unité de Recherche Innovation & Durabilité",   "code": "URID",  "type_entite": "recherche",
     "batiment_id": "b3", "batiment_nom": "Bâtiment Administratif",    "nb_personnes": 18},
]


# ── Endpoints ──────────────────────────────────────────────────
@router.get("/", summary="Lister tous les bâtiments du campus")
def lister_batiments(user: TokenData = Depends(get_utilisateur_actuel)):
    surface_totale = sum(b["surface_m2"] for b in BATIMENTS_DEMO if b.get("surface_m2"))
    return {
        "total": len(BATIMENTS_DEMO),
        "surface_totale_m2": surface_totale,
        "batiments": BATIMENTS_DEMO,
    }

@router.get("/{batiment_id}", summary="Détails d'un bâtiment")
def detail_batiment(batiment_id: str, user: TokenData = Depends(get_utilisateur_actuel)):
    bat = next((b for b in BATIMENTS_DEMO if b["id"] == batiment_id), None)
    if not bat:
        raise HTTPException(status_code=404, detail="Bâtiment introuvable")
    entites = [e for e in ENTITES_DEMO if e.get("batiment_id") == batiment_id]
    return {**bat, "entites": entites}

@router.get("/entites/toutes", summary="Lister toutes les entités")
def lister_entites(user: TokenData = Depends(get_utilisateur_actuel)):
    departements = [e for e in ENTITES_DEMO if e["type_entite"] == "departement"]
    recherche    = [e for e in ENTITES_DEMO if e["type_entite"] == "recherche"]
    return {
        "total":            len(ENTITES_DEMO),
        "nb_departements":  len(departements),
        "nb_recherche":     len(recherche),
        "population_totale": sum(e["nb_personnes"] for e in ENTITES_DEMO if e.get("nb_personnes")),
        "entites":          ENTITES_DEMO,
        "departements":     departements,
        "structures_recherche": recherche,
    }

@router.get("/stats/resume", summary="Résumé statistique du campus ENSIT")
def resume_campus(user: TokenData = Depends(get_utilisateur_actuel)):
    """Retourne les indicateurs structurels réels du campus ENSIT."""
    return {
        # Infrastructure
        "nb_batiments":          len(BATIMENTS_DEMO),
        "nb_entites":            settings.nb_entites_total,
        "nb_departements":       settings.nb_departements_enseignement,
        "nb_structures_recherche": settings.nb_structures_recherche,
        "surface_totale_m2":     sum(b["surface_m2"] for b in BATIMENTS_DEMO if b.get("surface_m2")),

        # Apprenants
        "nb_eleves_ingenieurs":  settings.nb_eleves_ingenieurs,
        "nb_masteriens":         settings.nb_masteriens,
        "nb_doctorants":         settings.nb_doctorants,
        "nb_diplomes_par_an":    settings.nb_diplomes_par_an,
        "nb_etudiants_total":    settings.nb_etudiants_total,

        # Personnel
        "nb_enseignants_permanents":   settings.nb_enseignants_permanents,
        "nb_enseignants_contractuels": settings.nb_enseignants_contractuels,
        "nb_enseignants_vacataires":   settings.nb_enseignants_vacataires,
        "nb_enseignants_experts":      settings.nb_enseignants_experts,
        "nb_enseignants_total":        settings.nb_enseignants_total,
        "corps_a_pct":                 settings.corps_a_pct,
        "nb_ingenieurs":               settings.nb_ingenieurs,
        "nb_techniciens":              settings.nb_techniciens,
        "nb_administratifs":           settings.nb_administratifs,
        "nb_personnel_total":          settings.nb_personnel_total,

        # Population campus
        "population_campus_totale":    settings.population_campus_totale,

        # ICP de référence (pour calculs)
        "nb_etudiants_reference":      settings.nb_etudiants_total,
        "population_reference_scope3": settings.population_campus_totale,
    }
