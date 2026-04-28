"""
Smart Green ENSIT — Module IA & Prédiction
==========================================
Analyse de tendances, prévision des émissions, détection des anomalies
Modèles : Régression linéaire, moyenne mobile, règles de décision
"""
import numpy as np
from dataclasses import dataclass
from typing import Optional
from enum import Enum


# ────────────────────────────────────────────────
# STRUCTURES DE DONNÉES
# ────────────────────────────────────────────────

class NiveauRisque(str, Enum):
    FAIBLE  = "faible"
    MODERE  = "modéré"
    ELEVE   = "élevé"
    CRITIQUE = "critique"

@dataclass
class PointHistorique:
    annee: int
    scope1_tco2e: float
    scope2_tco2e: float
    scope3_tco2e: float

    @property
    def total(self) -> float:
        return self.scope1_tco2e + self.scope2_tco2e + self.scope3_tco2e

@dataclass
class PrevisionAnnuelle:
    annee: int
    prevu_tco2e: float
    borne_basse: float
    borne_haute: float
    modele: str

@dataclass
class Tendance:
    pente_tco2e_par_an: float       # + = hausse, - = baisse
    variation_pct_par_an: float
    direction: str                   # "hausse", "baisse", "stable"
    score_r2: float                  # qualité de l'ajustement

@dataclass
class Anomalie:
    annee: int
    scope: str
    valeur_observee: float
    valeur_attendue: float
    ecart_pct: float
    niveau_risque: NiveauRisque
    message: str

@dataclass
class RecommandationIA:
    priorite: int                    # 1 = plus urgent
    categorie: str
    titre: str
    description: str
    reduction_potentielle_tco2e: float
    niveau_effort: str               # "faible", "modéré", "élevé"


# ────────────────────────────────────────────────
# RÉGRESSION LINÉAIRE (sans scikit-learn)
# ────────────────────────────────────────────────

def regression_lineaire(x: list[float], y: list[float]) -> tuple[float, float, float]:
    """
    Régression linéaire simple : y = a*x + b
    Retourne (pente a, intercept b, score R²)
    """
    n = len(x)
    if n < 2:
        return 0.0, y[0] if y else 0.0, 0.0

    mx, my = sum(x) / n, sum(y) / n
    num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    den = sum((xi - mx) ** 2 for xi in x)

    if den == 0:
        return 0.0, my, 0.0

    a = num / den
    b = my - a * mx

    # Calcul R²
    ss_res = sum((yi - (a * xi + b)) ** 2 for xi, yi in zip(x, y))
    ss_tot = sum((yi - my) ** 2 for yi in y)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    return a, b, r2


def moyenne_mobile(valeurs: list[float], fenetre: int = 3) -> list[float]:
    """Moyenne mobile pour lisser les tendances."""
    result = []
    for i in range(len(valeurs)):
        debut = max(0, i - fenetre + 1)
        result.append(sum(valeurs[debut:i+1]) / (i - debut + 1))
    return result


# ────────────────────────────────────────────────
# ANALYSEUR DE TENDANCES
# ────────────────────────────────────────────────

def analyser_tendance(historique: list[PointHistorique]) -> dict[str, Tendance]:
    """
    Analyse la tendance d'évolution pour chaque scope et le total.
    Retourne un dict : {'scope1': Tendance, 'scope2': ..., 'total': ...}
    """
    if len(historique) < 2:
        return {}

    annees = [float(p.annee) for p in historique]
    tendances = {}

    series = {
        "scope1": [p.scope1_tco2e for p in historique],
        "scope2": [p.scope2_tco2e for p in historique],
        "scope3": [p.scope3_tco2e for p in historique],
        "total":  [p.total for p in historique],
    }

    for nom, valeurs in series.items():
        pente, intercept, r2 = regression_lineaire(annees, valeurs)
        moy = sum(valeurs) / len(valeurs)
        variation_pct = (pente / moy * 100) if moy > 0 else 0.0

        if abs(variation_pct) < 0.5:
            direction = "stable"
        elif pente > 0:
            direction = "hausse"
        else:
            direction = "baisse"

        tendances[nom] = Tendance(
            pente_tco2e_par_an=round(pente, 3),
            variation_pct_par_an=round(variation_pct, 2),
            direction=direction,
            score_r2=round(r2, 3),
        )

    return tendances


# ────────────────────────────────────────────────
# PRÉVISIONS (FORECASTING)
# ────────────────────────────────────────────────

def prevoir_emissions(
    historique: list[PointHistorique],
    horizons: list[int],           # ex: [2026, 2027, 2028, 2030]
    modele: str = "regression_lineaire"
) -> list[PrevisionAnnuelle]:
    """
    Prédit les émissions totales pour les années futures.
    Modèles disponibles : 'regression_lineaire', 'moyenne_mobile'
    """
    if not historique:
        return []

    annees  = [float(p.annee) for p in historique]
    totaux  = [p.total for p in historique]
    derniere_annee = max(annees)

    previsions = []

    if modele == "regression_lineaire":
        pente, intercept, r2 = regression_lineaire(annees, totaux)
        ecart_type = (sum((t - (pente * a + intercept)) ** 2 for a, t in zip(annees, totaux)) / len(totaux)) ** 0.5

        for annee in horizons:
            prevu = pente * annee + intercept
            # Intervalle de confiance à 90% (±1.645σ, ajusté selon l'horizon)
            nb_annees_futur = annee - derniere_annee
            marge = 1.645 * ecart_type * (1 + 0.1 * nb_annees_futur)
            previsions.append(PrevisionAnnuelle(
                annee=annee,
                prevu_tco2e=round(max(0, prevu), 2),
                borne_basse=round(max(0, prevu - marge), 2),
                borne_haute=round(prevu + marge, 2),
                modele=f"Régression linéaire (R²={round(r2,3)})"
            ))

    elif modele == "moyenne_mobile":
        mm = moyenne_mobile(totaux, fenetre=3)
        derniere_mm = mm[-1]
        # Pente estimée sur les 3 derniers points
        pente_recente = (totaux[-1] - totaux[-3]) / 2 if len(totaux) >= 3 else 0

        for i, annee in enumerate(horizons):
            nb_annees = annee - derniere_annee
            prevu = derniere_mm + pente_recente * nb_annees
            marge = abs(prevu) * 0.08 * (1 + 0.05 * nb_annees)
            previsions.append(PrevisionAnnuelle(
                annee=annee,
                prevu_tco2e=round(max(0, prevu), 2),
                borne_basse=round(max(0, prevu - marge), 2),
                borne_haute=round(prevu + marge, 2),
                modele="Moyenne mobile (fenêtre=3)"
            ))

    return previsions


# ────────────────────────────────────────────────
# DÉTECTION D'ANOMALIES
# ────────────────────────────────────────────────

def detecter_anomalies(
    historique: list[PointHistorique],
    seuil_alerte_pct: float = 15.0,
) -> list[Anomalie]:
    """
    Détecte les valeurs anormales dans l'historique (écarts > seuil par rapport à la tendance).
    """
    if len(historique) < 3:
        return []

    annees  = [float(p.annee) for p in historique]
    anomalies = []

    series = {
        "Scope 1 (direct)":     [p.scope1_tco2e for p in historique],
        "Scope 2 (électricité)": [p.scope2_tco2e for p in historique],
        "Scope 3 (mobilité)":   [p.scope3_tco2e for p in historique],
    }

    for nom_scope, valeurs in series.items():
        pente, intercept, _ = regression_lineaire(annees, valeurs)
        for p, val in zip(historique, valeurs):
            attendu = pente * p.annee + intercept
            if attendu <= 0:
                continue
            ecart_pct = abs(val - attendu) / attendu * 100

            if ecart_pct >= seuil_alerte_pct:
                if ecart_pct >= 40:
                    risque = NiveauRisque.CRITIQUE
                elif ecart_pct >= 25:
                    risque = NiveauRisque.ELEVE
                elif ecart_pct >= 15:
                    risque = NiveauRisque.MODERE
                else:
                    risque = NiveauRisque.FAIBLE

                direction = "hausse" if val > attendu else "baisse"
                anomalies.append(Anomalie(
                    annee=p.annee,
                    scope=nom_scope,
                    valeur_observee=round(val, 2),
                    valeur_attendue=round(attendu, 2),
                    ecart_pct=round(ecart_pct, 1),
                    niveau_risque=risque,
                    message=f"{nom_scope} en {p.annee} : {direction} anormale de {round(ecart_pct,1)}% par rapport à la tendance attendue."
                ))

    return sorted(anomalies, key=lambda a: a.ecart_pct, reverse=True)


# ────────────────────────────────────────────────
# MOTEUR DE RECOMMANDATIONS
# ────────────────────────────────────────────────

def generer_recommandations(
    bilan_actuel: dict,
    tendances: dict[str, Tendance],
) -> list[RecommandationIA]:
    """
    Génère des recommandations priorisées basées sur le bilan et les tendances.
    """
    recommandations = []
    total = bilan_actuel.get("total_tco2e", 0)
    s2 = bilan_actuel.get("scope2", {}).get("total_tco2e", 0)
    s3 = bilan_actuel.get("scope3", {}).get("total_tco2e", 0)
    s1 = bilan_actuel.get("scope1", {}).get("total_tco2e", 0)

    # 1 — Réduction électricité si Scope 2 dominant
    if total > 0 and (s2 / total) > 0.4:
        recommandations.append(RecommandationIA(
            priorite=1,
            categorie="Énergie",
            titre="Réduire la consommation électrique (priorité haute)",
            description=(
                f"Le Scope 2 représente {round(s2/total*100,1)}% du bilan total. "
                "Actions recommandées : remplacement des éclairages par LED, "
                "installation de minuteries et détecteurs de présence, "
                "optimisation des horaires des équipements énergivores."
            ),
            reduction_potentielle_tco2e=round(s2 * 0.20, 2),
            niveau_effort="modéré",
        ))

    # 2 — Report modal si Scope 3 significatif
    if total > 0 and (s3 / total) > 0.15:
        recommandations.append(RecommandationIA(
            priorite=2,
            categorie="Mobilité",
            titre="Encourager le report modal domicile-campus",
            description=(
                f"La mobilité représente {round(s3/total*100,1)}% des émissions. "
                "Actions : développer le covoiturage (plateforme numérique), "
                "négocier des abonnements transports en commun subventionnés, "
                "créer des parkings vélos sécurisés."
            ),
            reduction_potentielle_tco2e=round(s3 * 0.30, 2),
            niveau_effort="faible",
        ))

    # 3 — Énergie solaire si bilan > 1000 tCO₂e
    if total > 1000:
        recommandations.append(RecommandationIA(
            priorite=3,
            categorie="Énergie renouvelable",
            titre="Installer des panneaux solaires photovoltaïques",
            description=(
                "Avec un bilan supérieur à 1 000 tCO₂e/an, l'installation de "
                "panneaux solaires sur les toitures permettrait de couvrir "
                "30 à 40% des besoins électriques du campus."
            ),
            reduction_potentielle_tco2e=round(s2 * 0.35, 2),
            niveau_effort="élevé",
        ))

    # 4 — Maintenance climatisation si Scope 1 frigorigènes
    s1_frigo = bilan_actuel.get("scope1", {}).get("frigorigenes_tco2e", 0)
    if s1_frigo > 5:
        recommandations.append(RecommandationIA(
            priorite=4,
            categorie="Maintenance",
            titre="Audit et étanchéité des systèmes de climatisation",
            description=(
                f"Les fuites frigorigènes génèrent {round(s1_frigo, 1)} tCO₂e. "
                "Un programme de détection préventive et de remplacement par des "
                "fluides à faible PRG (ex. R-32 au lieu de R-410A) réduirait "
                "significativement ces émissions."
            ),
            reduction_potentielle_tco2e=round(s1_frigo * 0.60, 2),
            niveau_effort="modéré",
        ))

    # 5 — Alerte tendance haussière
    tendance_total = tendances.get("total")
    if tendance_total and tendance_total.direction == "hausse" and tendance_total.variation_pct_par_an > 2:
        recommandations.append(RecommandationIA(
            priorite=1,
            categorie="Alerte tendance",
            titre=f"Tendance haussière détectée (+{tendance_total.variation_pct_par_an}%/an)",
            description=(
                "Le bilan carbone progresse de façon continue. Sans action corrective, "
                f"les émissions pourraient augmenter de {round(tendance_total.variation_pct_par_an * 5, 1)}% "
                "d'ici 5 ans. Un plan d'action immédiat est recommandé."
            ),
            reduction_potentielle_tco2e=round(total * 0.05, 2),
            niveau_effort="modéré",
        ))

    return sorted(recommandations, key=lambda r: r.priorite)


# ────────────────────────────────────────────────
# ANALYSE COMPLÈTE (point d'entrée principal)
# ────────────────────────────────────────────────

def analyser_donnees_campus(
    historique: list[PointHistorique],
    bilan_actuel: dict,
    horizons_prevision: list[int] = None,
) -> dict:
    """
    Lance l'analyse IA complète : tendances + prévisions + anomalies + recommandations.
    """
    if horizons_prevision is None:
        annee_actuelle = max(p.annee for p in historique) if historique else 2025
        horizons_prevision = [annee_actuelle + i for i in range(1, 6)]

    tendances = analyser_tendance(historique)
    previsions_rl = prevoir_emissions(historique, horizons_prevision, "regression_lineaire")
    previsions_mm = prevoir_emissions(historique, horizons_prevision, "moyenne_mobile")
    anomalies = detecter_anomalies(historique)
    recommandations = generer_recommandations(bilan_actuel, tendances)

    return {
        "tendances": {
            k: {
                "pente_tco2e_par_an": t.pente_tco2e_par_an,
                "variation_pct_par_an": t.variation_pct_par_an,
                "direction": t.direction,
                "score_r2": t.score_r2,
            } for k, t in tendances.items()
        },
        "previsions": {
            "regression_lineaire": [
                {"annee": p.annee, "prevu_tco2e": p.prevu_tco2e,
                 "borne_basse": p.borne_basse, "borne_haute": p.borne_haute,
                 "modele": p.modele}
                for p in previsions_rl
            ],
            "moyenne_mobile": [
                {"annee": p.annee, "prevu_tco2e": p.prevu_tco2e,
                 "borne_basse": p.borne_basse, "borne_haute": p.borne_haute,
                 "modele": p.modele}
                for p in previsions_mm
            ],
        },
        "anomalies": [
            {"annee": a.annee, "scope": a.scope,
             "valeur_observee": a.valeur_observee, "valeur_attendue": a.valeur_attendue,
             "ecart_pct": a.ecart_pct, "niveau_risque": a.niveau_risque,
             "message": a.message}
            for a in anomalies
        ],
        "recommandations": [
            {"priorite": r.priorite, "categorie": r.categorie,
             "titre": r.titre, "description": r.description,
             "reduction_potentielle_tco2e": r.reduction_potentielle_tco2e,
             "niveau_effort": r.niveau_effort}
            for r in recommandations
        ],
        "resume": {
            "nb_anomalies_detectees": len(anomalies),
            "nb_recommandations": len(recommandations),
            "direction_generale": tendances.get("total", Tendance(0,0,"stable",0)).direction,
            "reduction_potentielle_totale_tco2e": round(
                sum(r.reduction_potentielle_tco2e for r in recommandations), 2
            ),
        }
    }


# ────────────────────────────────────────────────
# TEST RAPIDE
# ────────────────────────────────────────────────
if __name__ == "__main__":
    import json

    historique_demo = [
        PointHistorique(2021, 210, 830, 245),
        PointHistorique(2022, 205, 820, 260),
        PointHistorique(2023, 195, 805, 270),
        PointHistorique(2024, 190, 812, 278),
        PointHistorique(2025, 193, 809, 282),
    ]
    bilan_demo = {
        "total_tco2e": 1284,
        "scope1": {"total_tco2e": 193, "frigorigenes_tco2e": 21},
        "scope2": {"total_tco2e": 809},
        "scope3": {"total_tco2e": 282},
    }
    resultat = analyser_donnees_campus(historique_demo, bilan_demo)
    print(json.dumps(resultat, indent=2, ensure_ascii=False))
