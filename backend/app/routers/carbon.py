"""
Smart Green ENSIT — Routeur API Bilan Carbone
Endpoints pour le calcul, les ICP et la visualisation
"""
from fastapi import APIRouter, HTTPException, Depends
from app.core.securite import get_utilisateur_actuel, require_manager_ou_admin, TokenData
from pydantic import BaseModel, Field
from typing import Optional
from app.services.calculateur_carbone import (
    DonneesScope1, DonneesScope2, DonneesScope3, RepondantMobilite,
    calculer_bilan_carbone, simuler_scenario
)

router = APIRouter()


# ─────────────────────────────────────
# SCHÉMAS PYDANTIC (validation requêtes)
# ─────────────────────────────────────

class RepondantSchema(BaseModel):
    mode_transport: str = Field(..., example="voiture_solo",
        description="Mode de transport : voiture_solo, covoiturage, bus, train, metro, moto, velo, marche")
    distance_aller_km: float = Field(..., gt=0, example=12.5)
    jours_par_semaine: float = Field(..., gt=0, le=7, example=5)
    semaines_par_an: int = Field(default=36, ge=1, le=52)

class Scope1Schema(BaseModel):
    gaz_naturel_m3: float = Field(default=0.0, ge=0, example=15000)
    fioul_litres: float = Field(default=0.0, ge=0)
    essence_litres: float = Field(default=0.0, ge=0)
    diesel_litres: float = Field(default=0.0, ge=0)
    refrigerant_kg: float = Field(default=0.0, ge=0)
    gwp_refrigerant: float = Field(default=0.0, ge=0, example=2088,
        description="PRG du fluide frigorigène (ex: R-410A = 2088)")

class Scope2Schema(BaseModel):
    electricite_kwh: float = Field(default=0.0, ge=0, example=450000)

class Scope3Schema(BaseModel):
    repondants: list[RepondantSchema] = []
    population_totale: Optional[int] = Field(default=None, gt=0,
        description="Population totale du campus pour extrapolation")

class BilanCarbone_Request(BaseModel):
    scope1: Scope1Schema
    scope2: Scope2Schema
    scope3: Scope3Schema
    nb_etudiants: Optional[int] = Field(default=None, gt=0, example=2500)
    surface_totale_m2: Optional[float] = Field(default=None, gt=0, example=12000)
    nb_entites: Optional[int] = Field(default=None, gt=0, example=8)

class Scenario_Request(BaseModel):
    bilan_base: BilanCarbone_Request
    reduction_electricite_pct: float = Field(default=0.0, ge=0, le=100,
        description="Réduction de la consommation électrique en %")
    reduction_gaz_pct: float = Field(default=0.0, ge=0, le=100,
        description="Réduction de la consommation de gaz en %")
    report_modal_voiture_vers_bus_pct: float = Field(default=0.0, ge=0, le=100,
        description="% de trajets voiture reportés vers le bus")


# ─────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────

@router.post("/calculer", summary="Calculer le bilan carbone complet")
def calculer_bilan(req: BilanCarbone_Request, user: TokenData = Depends(get_utilisateur_actuel)):
    """
    Calcule le bilan carbone Scopes 1, 2 et 3 à partir des données saisies.
    Retourne les totaux par scope, le grand total en tCO₂e, et les ICP normalisés.
    """
    try:
        s1 = DonneesScope1(**req.scope1.model_dump())
        s2 = DonneesScope2(**req.scope2.model_dump())
        s3 = DonneesScope3(
            repondants=[RepondantMobilite(**r.model_dump()) for r in req.scope3.repondants],
            population_totale=req.scope3.population_totale
        )
        bilan = calculer_bilan_carbone(
            s1, s2, s3,
            nb_etudiants=req.nb_etudiants,
            surface_totale_m2=req.surface_totale_m2,
            nb_entites=req.nb_entites
        )
        return {"statut": "succès", "bilan": bilan.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de calcul : {str(e)}")


@router.post("/simuler-scenario", summary="Simuler un scénario de réduction")
def simuler(req: Scenario_Request, user: TokenData = Depends(require_manager_ou_admin)):
    """
    Simule l'impact de mesures de réduction sur le bilan carbone.
    Paramètres disponibles : réduction électricité, réduction gaz, report modal vers bus.
    """
    try:
        s1 = DonneesScope1(**req.bilan_base.scope1.model_dump())
        s2 = DonneesScope2(**req.bilan_base.scope2.model_dump())
        s3 = DonneesScope3(
            repondants=[RepondantMobilite(**r.model_dump()) for r in req.bilan_base.scope3.repondants],
            population_totale=req.bilan_base.scope3.population_totale
        )
        bilan = calculer_bilan_carbone(s1, s2, s3,
            nb_etudiants=req.bilan_base.nb_etudiants,
            surface_totale_m2=req.bilan_base.surface_totale_m2,
            nb_entites=req.bilan_base.nb_entites
        )
        resultat = simuler_scenario(
            bilan,
            reduction_electricite_pct=req.reduction_electricite_pct,
            reduction_gaz_pct=req.reduction_gaz_pct,
            report_modal_voiture_vers_bus_pct=req.report_modal_voiture_vers_bus_pct,
        )
        return {"statut": "succès", "simulation": resultat}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur simulation : {str(e)}")


@router.get("/facteurs-emission", summary="Consulter les facteurs d'émission utilisés")
def get_facteurs():
    """Retourne tous les facteurs d'émission de référence (ADEME Base Carbone)."""
    return {
        "source": "ADEME Base Carbone / GHG Protocol",
        "unite": "kgCO₂e par unité",
        "scope2": {
            "electricite_tunisie": {"valeur": 0.559, "unite": "kWh", "note": "Mix réseau STEG 2023"}
        },
        "scope1": {
            "gaz_naturel":      {"valeur": 2.012, "unite": "m³"},
            "fioul_domestique": {"valeur": 3.154, "unite": "litre"},
            "essence_sp95":     {"valeur": 2.281, "unite": "litre"},
            "diesel":           {"valeur": 2.512, "unite": "litre"},
        },
        "scope3_mobilite": {
            "voiture_solo":  {"valeur": 0.218, "unite": "km"},
            "covoiturage":   {"valeur": 0.109, "unite": "km"},
            "bus":           {"valeur": 0.029, "unite": "km"},
            "train_metro":   {"valeur": 0.011, "unite": "km"},
            "moto_scooter":  {"valeur": 0.103, "unite": "km"},
            "velo_marche":   {"valeur": 0.000, "unite": "km"},
        }
    }
