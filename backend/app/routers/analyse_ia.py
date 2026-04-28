"""
Smart Green ENSIT — Routeur IA & Analyse
Endpoints pour les prévisions, tendances, anomalies et recommandations
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.core.securite import get_utilisateur_actuel, TokenData
from app.core.config import settings
from app.services.module_ia import (
    PointHistorique, analyser_donnees_campus,
    prevoir_emissions, detecter_anomalies, generer_recommandations,
    analyser_tendance
)

router = APIRouter()


# ── Schémas ──────────────────────────────────────────────────
class PointHistoriqueSchema(BaseModel):
    annee: int = Field(..., ge=2015, le=2030, example=2024)
    scope1_tco2e: float = Field(..., ge=0, example=193.0)
    scope2_tco2e: float = Field(..., ge=0, example=809.0)
    scope3_tco2e: float = Field(..., ge=0, example=282.0)

class BilanActuelSchema(BaseModel):
    total_tco2e: float
    scope1: dict
    scope2: dict
    scope3: dict

class AnalyseCompleteRequest(BaseModel):
    historique: list[PointHistoriqueSchema] = Field(..., min_length=2,
        description="Historique d'au moins 2 années")
    bilan_actuel: BilanActuelSchema
    horizons_prevision: Optional[list[int]] = Field(
        default=None,
        example=[2026, 2027, 2028, 2029, 2030]
    )


# ── Données de démonstration ENSIT ───────────────────────────
HISTORIQUE_DEMO = [
    PointHistorique(2021, 210, 830, 245),
    PointHistorique(2022, 205, 820, 260),
    PointHistorique(2023, 195, 805, 270),
    PointHistorique(2024, 190, 812, 278),
    PointHistorique(2025, 193, 809, 282),
]
BILAN_DEMO = {
    "total_tco2e": 1284,
    "scope1": {"total_tco2e": 193, "frigorigenes_tco2e": 21,
               "combustion_tco2e": 134, "vehicules_tco2e": 38},
    "scope2": {"total_tco2e": 809},
    "scope3": {"total_tco2e": 282},
}


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/demo", summary="Analyse IA complète avec données de démonstration ENSIT")
def analyse_demo(user: TokenData = Depends(get_utilisateur_actuel)):
    """
    Lance l'analyse IA complète sur les données de démonstration ENSIT (période dynamique).
    Inclut : tendances, prévisions 2026-2030, anomalies, recommandations priorisées.
    """
    return analyser_donnees_campus(HISTORIQUE_DEMO, BILAN_DEMO)


@router.post("/analyser", summary="Analyse IA sur données personnalisées")
def analyser(req: AnalyseCompleteRequest, user: TokenData = Depends(get_utilisateur_actuel)):
    """
    Lance l'analyse IA complète sur les données fournies par l'utilisateur.
    """
    historique = [PointHistorique(**p.model_dump()) for p in req.historique]
    bilan = req.bilan_actuel.model_dump()
    return analyser_donnees_campus(historique, bilan, req.horizons_prevision)


@router.get("/tendances", summary="Tendances d'évolution par scope")
def tendances(user: TokenData = Depends(get_utilisateur_actuel)):
    """Retourne l'analyse de tendance (régression linéaire) pour les données de démo."""
    tendances_dict = analyser_tendance(HISTORIQUE_DEMO)
    return {
        k: {
            "pente_tco2e_par_an": t.pente_tco2e_par_an,
            "variation_pct_par_an": t.variation_pct_par_an,
            "direction": t.direction,
            "score_r2": t.score_r2,
            "interpretation": (
                f"Les émissions {t.direction} de {abs(t.variation_pct_par_an):.1f}% par an "
                f"(R²={t.score_r2:.2f})"
            )
        }
        for k, t in tendances_dict.items()
    }


@router.get("/previsions/{horizon_annees}", summary="Prévisions d'émissions")
def previsions(
    horizon_annees: int = 5,
    modele: str = "regression_lineaire",
    user: TokenData = Depends(get_utilisateur_actuel)
):
    """
    Prévoit les émissions pour les N prochaines années.
    Modèles : 'regression_lineaire' (recommandé), 'moyenne_mobile'
    """
    annee_base = max(p.annee for p in HISTORIQUE_DEMO)
    horizons = [annee_base + i for i in range(1, horizon_annees + 1)]
    previsions = prevoir_emissions(HISTORIQUE_DEMO, horizons, modele)
    return {
        "modele": modele,
        "annee_base": annee_base,
        "previsions": [
            {"annee": p.annee, "prevu_tco2e": p.prevu_tco2e,
             "borne_basse": p.borne_basse, "borne_haute": p.borne_haute}
            for p in previsions
        ]
    }


@router.get("/anomalies", summary="Détection d'anomalies dans l'historique")
def anomalies(
    seuil_pct: float = 15.0,
    user: TokenData = Depends(get_utilisateur_actuel)
):
    """
    Détecte les valeurs anormales dans l'historique (écart > seuil% vs tendance).
    """
    anomalies_detectees = detecter_anomalies(HISTORIQUE_DEMO, seuil_pct)
    return {
        "seuil_alerte_pct": seuil_pct,
        "nb_anomalies": len(anomalies_detectees),
        "anomalies": [
            {"annee": a.annee, "scope": a.scope,
             "valeur_observee": a.valeur_observee,
             "valeur_attendue": a.valeur_attendue,
             "ecart_pct": a.ecart_pct,
             "niveau_risque": a.niveau_risque,
             "message": a.message}
            for a in anomalies_detectees
        ]
    }


@router.get("/recommandations", summary="Recommandations IA priorisées")
def recommandations(user: TokenData = Depends(get_utilisateur_actuel)):
    """
    Génère des recommandations de réduction priorisées basées sur le bilan actuel.
    """
    tendances_dict = analyser_tendance(HISTORIQUE_DEMO)
    recs = generer_recommandations(BILAN_DEMO, tendances_dict)
    return {
        "nb_recommandations": len(recs),
        "reduction_totale_potentielle_tco2e": round(
            sum(r.reduction_potentielle_tco2e for r in recs), 2
        ),
        "recommandations": [
            {"priorite": r.priorite, "categorie": r.categorie,
             "titre": r.titre, "description": r.description,
             "reduction_potentielle_tco2e": r.reduction_potentielle_tco2e,
             "niveau_effort": r.niveau_effort}
            for r in recs
        ]
    }
