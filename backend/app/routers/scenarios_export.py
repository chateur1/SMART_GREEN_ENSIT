"""
Smart Green ENSIT — Routeurs Scénarios & Export
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional
from app.core.securite import get_utilisateur_actuel, require_manager_ou_admin, TokenData
from app.core.config import settings


# ══════════════════════════════════════════════════════════
# SCÉNARIOS DE SIMULATION
# ══════════════════════════════════════════════════════════
router_scenarios = APIRouter()

from app.services.calculateur_carbone import (
    DonneesScope1, DonneesScope2, DonneesScope3, RepondantMobilite,
    calculer_bilan_carbone, simuler_scenario
)

# Bilan de référence ENSIT — période dynamique
def _get_bilan_reference():
    """Bilan de référence basé sur les données réelles du campus ENSIT."""
    s1 = DonneesScope1(gaz_naturel_m3=15200, fioul_litres=1800,
                       essence_litres=520, diesel_litres=840,
                       refrigerant_kg=9.5, gwp_refrigerant=2088)
    s2 = DonneesScope2(electricite_kwh=460000)
    # Population réelle campus : 1525 personnes (1300 étudiants + 225 personnel)
    repondants = [
        RepondantMobilite("voiture_solo", 14.0, 5, 36),
        RepondantMobilite("bus", 10.0, 5, 36),
        RepondantMobilite("moto", 9.0, 5, 36),
        RepondantMobilite("train", 20.0, 5, 36),
        RepondantMobilite("covoiturage", 15.0, 4, 36),
    ] * 62
    s3 = DonneesScope3(
        repondants=repondants,
        population_totale=settings.population_campus_totale  # 1525
    )
    return calculer_bilan_carbone(
        s1, s2, s3,
        nb_etudiants=settings.nb_etudiants_total,      # 1300
        surface_totale_m2=settings.surface_campus_m2,  # 11100
        nb_entites=settings.nb_entites_total,           # 13
    )


class ScenarioRequest(BaseModel):
    nom: str = Field(..., example="Scénario Transition Verte 2027")
    description: Optional[str] = None
    reduction_electricite_pct: float = Field(default=0.0, ge=0, le=100,
        description="Réduction conso électrique via LED, minuteries, etc. (%)")
    reduction_gaz_pct: float = Field(default=0.0, ge=0, le=100,
        description="Réduction consommation gaz (%)")
    report_modal_bus_pct: float = Field(default=0.0, ge=0, le=100,
        description="% de trajets voiture convertis en bus (%)")


SCENARIOS_DEMO = [
    {
        "id": "sc1",
        "nom": "Scénario Efficacité Énergétique",
        "description": "Remplacement éclairages LED + minuteries + optimisation horaires",
        "parametres": {"reduction_electricite_pct": 20, "reduction_gaz_pct": 0, "report_modal_bus_pct": 0},
        "resultats": {"baseline_tco2e": 1284, "simule_tco2e": 1122, "reduction_tco2e": 162, "reduction_pct": 12.6},
    },
    {
        "id": "sc2",
        "nom": "Scénario Mobilité Durable",
        "description": "Plateforme covoiturage + abonnements TCT subventionnés",
        "parametres": {"reduction_electricite_pct": 0, "reduction_gaz_pct": 0, "report_modal_bus_pct": 30},
        "resultats": {"baseline_tco2e": 1284, "simule_tco2e": 1218, "reduction_tco2e": 66, "reduction_pct": 5.1},
    },
    {
        "id": "sc3",
        "nom": "Scénario Transition Complète",
        "description": "Combinaison LED + covoiturage + réduction gaz 15%",
        "parametres": {"reduction_electricite_pct": 20, "reduction_gaz_pct": 15, "report_modal_bus_pct": 30},
        "resultats": {"baseline_tco2e": 1284, "simule_tco2e": 1030, "reduction_tco2e": 254, "reduction_pct": 19.8},
    },
]


@router_scenarios.get("/", summary="Lister les scénarios enregistrés")
def lister_scenarios(user: TokenData = Depends(get_utilisateur_actuel)):
    return {"total": len(SCENARIOS_DEMO), "scenarios": SCENARIOS_DEMO}

@router_scenarios.post("/simuler", summary="Simuler un nouveau scénario")
def simuler(req: ScenarioRequest, user: TokenData = Depends(require_manager_ou_admin)):
    """Lance une simulation et retourne la comparaison avant/après."""
    bilan = _get_bilan_reference()
    resultat = simuler_scenario(
        bilan,
        reduction_electricite_pct=req.reduction_electricite_pct,
        reduction_gaz_pct=req.reduction_gaz_pct,
        report_modal_voiture_vers_bus_pct=req.report_modal_bus_pct,
    )
    return {
        "statut": "simulation effectuée",
        "scenario": {
            "nom": req.nom,
            "description": req.description,
            "parametres": {
                "reduction_electricite_pct": req.reduction_electricite_pct,
                "reduction_gaz_pct": req.reduction_gaz_pct,
                "report_modal_bus_pct": req.report_modal_bus_pct,
            }
        },
        "resultats": resultat,
        "interpretation": (
            f"Ce scénario permettrait de réduire les émissions de "
            f"{resultat['reduction_tco2e']:.1f} tCO₂e "
            f"({resultat['reduction_pct']:.1f}% du bilan total)"
        )
    }

@router_scenarios.get("/presets", summary="Scénarios prédéfinis recommandés")
def get_presets():
    """Retourne des scénarios standards pré-calculés pour faciliter la prise de décision."""
    return {
        "message": f"Scénarios pré-calculés sur la base du bilan ENSIT {settings.periode_active}",
        "presets": [
            {
                "code": "LED_COMPLET",
                "titre": "Migration LED complète",
                "impact_estime": "−15 à −20% Scope 2",
                "cout_indicatif": "Moyen",
                "delai_retour": "3-4 ans",
                "parametres": {"reduction_electricite_pct": 18, "reduction_gaz_pct": 0, "report_modal_bus_pct": 0}
            },
            {
                "code": "SOLAIRE",
                "titre": "Panneaux solaires toitures",
                "impact_estime": "−30 à −40% Scope 2",
                "cout_indicatif": "Élevé",
                "delai_retour": "7-10 ans",
                "parametres": {"reduction_electricite_pct": 35, "reduction_gaz_pct": 0, "report_modal_bus_pct": 0}
            },
            {
                "code": "COVOITURAGE",
                "titre": "Plateforme covoiturage",
                "impact_estime": "−8 à −12% Scope 3",
                "cout_indicatif": "Faible",
                "delai_retour": "< 1 an",
                "parametres": {"reduction_electricite_pct": 0, "reduction_gaz_pct": 0, "report_modal_bus_pct": 25}
            },
        ]
    }


# ══════════════════════════════════════════════════════════
# EXPORT PDF & EXCEL
# ══════════════════════════════════════════════════════════
router_export = APIRouter()

def _get_bilan_demo_dict():
    """Bilan démo avec ICP calculés sur les données réelles ENSIT."""
    total = 1284.0
    return {
        "total_tco2e": total,
        "scope1": {
            "total_tco2e": 193.0,
            "combustion_tco2e": 135.2,
            "vehicules_tco2e": 37.8,
            "frigorigenes_tco2e": 20.0,
        },
        "scope2": {"total_tco2e": 809.0},
        "scope3": {
            "total_tco2e": 282.0,
            "nb_repondants": 312,
            "facteur_extrapolation": round(settings.population_campus_totale / 312, 2),
            "par_mode": {"voiture_solo": 128.0, "bus": 74.0, "moto": 52.0, "train": 21.0},
        },
        "icp": {
            # ICP calculés sur les données réelles ENSIT
            "tco2e_par_etudiant": round(total / settings.nb_etudiants_total, 4),  # /1300
            "tco2e_par_m2":       round(total / settings.surface_campus_m2, 4),   # /11100
            "tco2e_par_entite":   round(total / settings.nb_entites_total, 2),    # /13
        },
    }


@router_export.get("/pdf",
    summary="Exporter le bilan carbone en PDF",
    response_class=Response,
)
def exporter_pdf(
    periode: str = None,
    user: TokenData = Depends(get_utilisateur_actuel)
):
    """Génère le rapport PDF complet du bilan carbone ENSIT."""
    try:
        from app.services.export_service import generer_rapport_pdf
        bilan = _get_bilan_demo_dict()
        periode_resolved = periode or settings.periode_active
        pdf_bytes = generer_rapport_pdf(bilan, periode_resolved)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Bilan_Carbone_ENSIT_{periode_resolved}.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération PDF : {str(e)}")


@router_export.get("/excel",
    summary="Exporter le bilan carbone en Excel",
    response_class=Response,
)
def exporter_excel(
    periode: str = None,
    user: TokenData = Depends(get_utilisateur_actuel)
):
    """Génère le classeur Excel complet du bilan carbone ENSIT."""
    try:
        from app.services.export_service import generer_excel
        bilan = _get_bilan_demo_dict()
        periode_resolved = periode or settings.periode_active
        excel_bytes = generer_excel(bilan, periode_resolved)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="Bilan_Carbone_ENSIT_{periode_resolved}.xlsx"',
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération Excel : {str(e)}")


@router_export.get("/formats-disponibles", summary="Formats d'export disponibles")
def formats_export(user: TokenData = Depends(get_utilisateur_actuel)):
    return {
        "formats": [
            {"code": "pdf",   "label": "Rapport PDF complet",     "endpoint": "/api/export/pdf",   "icon": "📄"},
            {"code": "excel", "label": "Classeur Excel détaillé", "endpoint": "/api/export/excel", "icon": "📊"},
        ]
    }


@router_export.get("/periode-active", summary="Obtenir la période de reporting active")
def get_periode_active():
    """Retourne la période de reporting actuellement configurée + stats campus."""
    return {
        "periode":      settings.periode_active,
        "annee_debut":  settings.annee_debut,
        "annee_fin":    settings.annee_fin,
        "source":       "ANNEE_REPORTING (.env)" if settings.annee_reporting else "Calcul automatique",
        "campus": {
            "nb_etudiants_total":   settings.nb_etudiants_total,
            "population_totale":    settings.population_campus_totale,
            "surface_m2":           settings.surface_campus_m2,
            "nb_entites":           settings.nb_entites_total,
        }
    }
