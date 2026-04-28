"""
Smart Green ENSIT — Moteur de Calcul du Bilan Carbone
=====================================================
Implémentation du GHG Protocol (Scopes 1, 2, 3)
Facteurs d'émission : ADEME Base Carbone
"""
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


# ─────────────────────────────────────────────
# FACTEURS D'ÉMISSION (ADEME Base Carbone 2023)
# ─────────────────────────────────────────────

class FacteursEmission:
    """
    Facteurs d'émission de référence (kgCO₂e par unité).
    Source : ADEME Base Carbone / GHG Protocol
    """

    # SCOPE 2 — Électricité
    ELECTRICITE_TUNISIE = 0.559        # kgCO₂e / kWh (mix réseau tunisien, estimation 2023)

    # SCOPE 1 — Combustibles
    GAZ_NATUREL        = 2.012         # kgCO₂e / m³
    FIOUL_DOMESTIQUE   = 3.154         # kgCO₂e / litre
    ESSENCE            = 2.281         # kgCO₂e / litre (SP95)
    DIESEL             = 2.512         # kgCO₂e / litre

    # SCOPE 3 — Mobilité domicile-campus (kgCO₂e / km / passager)
    VOITURE_SOLO       = 0.218
    COVOITURAGE_2P     = 0.109
    BUS                = 0.029
    TRAIN_METRO        = 0.011
    MOTO_SCOOTER       = 0.103
    VELO_MARCHE        = 0.000


# ─────────────────────────────────────────────
# DATACLASSES DE DONNÉES D'ENTRÉE
# ─────────────────────────────────────────────

@dataclass
class DonneesScope1:
    """Données Scope 1 : émissions directes"""
    # Combustion sur site
    gaz_naturel_m3: float = 0.0
    fioul_litres: float = 0.0

    # Véhicules de l'établissement
    essence_litres: float = 0.0
    diesel_litres: float = 0.0

    # Fuites frigorigènes
    refrigerant_kg: float = 0.0
    gwp_refrigerant: float = 0.0        # Pouvoir de Réchauffement Global

@dataclass
class DonneesScope2:
    """Données Scope 2 : énergie indirecte"""
    electricite_kwh: float = 0.0

@dataclass
class RepondantMobilite:
    """Un répondant à l'enquête de mobilité (Scope 3)"""
    mode_transport: str                  # 'voiture_solo', 'bus', 'train', etc.
    distance_aller_km: float
    jours_par_semaine: float
    semaines_par_an: int = 36

@dataclass
class DonneesScope3:
    """Données Scope 3 : mobilité domicile-campus"""
    repondants: list[RepondantMobilite] = field(default_factory=list)
    population_totale: Optional[int] = None   # Pour extrapolation si enquête partielle


# ─────────────────────────────────────────────
# RÉSULTATS DE CALCUL
# ─────────────────────────────────────────────

@dataclass
class ResultatScope1:
    combustion_tco2e: float
    vehicules_tco2e: float
    frigorigenes_tco2e: float
    total_tco2e: float

@dataclass
class ResultatScope2:
    electricite_tco2e: float
    total_tco2e: float

@dataclass
class ResultatScope3:
    par_mode: dict[str, float]          # tCO₂e par mode de transport
    total_enquete_tco2e: float
    total_extrapole_tco2e: float
    facteur_extrapolation: float
    nb_repondants: int

@dataclass
class BilanCarbone:
    """Résultat consolidé du bilan carbone"""
    scope1: ResultatScope1
    scope2: ResultatScope2
    scope3: ResultatScope3
    total_tco2e: float

    # ICP normalisés obligatoires
    nb_etudiants: Optional[int] = None
    surface_totale_m2: Optional[float] = None
    nb_entites: Optional[int] = None

    @property
    def icp_par_etudiant(self) -> Optional[float]:
        if self.nb_etudiants and self.nb_etudiants > 0:
            return round(self.total_tco2e / self.nb_etudiants, 4)
        return None

    @property
    def icp_par_m2(self) -> Optional[float]:
        if self.surface_totale_m2 and self.surface_totale_m2 > 0:
            return round(self.total_tco2e / self.surface_totale_m2, 4)
        return None

    @property
    def icp_par_entite(self) -> Optional[float]:
        if self.nb_entites and self.nb_entites > 0:
            return round(self.total_tco2e / self.nb_entites, 4)
        return None

    def to_dict(self) -> dict:
        return {
            "scope1": {
                "combustion_tco2e": self.scope1.combustion_tco2e,
                "vehicules_tco2e": self.scope1.vehicules_tco2e,
                "frigorigenes_tco2e": self.scope1.frigorigenes_tco2e,
                "total_tco2e": self.scope1.total_tco2e,
            },
            "scope2": {
                "electricite_tco2e": self.scope2.electricite_tco2e,
                "total_tco2e": self.scope2.total_tco2e,
            },
            "scope3": {
                "par_mode": self.scope3.par_mode,
                "total_tco2e": self.scope3.total_extrapole_tco2e,
                "nb_repondants": self.scope3.nb_repondants,
            },
            "total_tco2e": self.total_tco2e,
            "icp": {
                "tco2e_par_etudiant": self.icp_par_etudiant,
                "tco2e_par_m2": self.icp_par_m2,
                "tco2e_par_entite": self.icp_par_entite,
            }
        }


# ─────────────────────────────────────────────
# MOTEUR DE CALCUL PRINCIPAL
# ─────────────────────────────────────────────

KG_TO_TONNES = 1 / 1000

FACTEURS_MOBILITE = {
    "voiture_solo":   FacteursEmission.VOITURE_SOLO,
    "covoiturage":    FacteursEmission.COVOITURAGE_2P,
    "bus":            FacteursEmission.BUS,
    "train":          FacteursEmission.TRAIN_METRO,
    "metro":          FacteursEmission.TRAIN_METRO,
    "moto":           FacteursEmission.MOTO_SCOOTER,
    "velo":           FacteursEmission.VELO_MARCHE,
    "marche":         FacteursEmission.VELO_MARCHE,
}


def calculer_scope1(donnees: DonneesScope1) -> ResultatScope1:
    """
    Calcule les émissions directes Scope 1.
    Formule : quantité × facteur_émission → kgCO₂e → tCO₂e
    """
    # Combustion sur site
    co2e_gaz   = donnees.gaz_naturel_m3  * FacteursEmission.GAZ_NATUREL
    co2e_fioul = donnees.fioul_litres    * FacteursEmission.FIOUL_DOMESTIQUE
    combustion = (co2e_gaz + co2e_fioul) * KG_TO_TONNES

    # Véhicules de l'établissement
    co2e_essence = donnees.essence_litres * FacteursEmission.ESSENCE
    co2e_diesel  = donnees.diesel_litres  * FacteursEmission.DIESEL
    vehicules    = (co2e_essence + co2e_diesel) * KG_TO_TONNES

    # Fuites frigorigènes : quantité (kg) × PRG
    frigorigenes = (donnees.refrigerant_kg * donnees.gwp_refrigerant) * KG_TO_TONNES

    total = round(combustion + vehicules + frigorigenes, 4)

    return ResultatScope1(
        combustion_tco2e=round(combustion, 4),
        vehicules_tco2e=round(vehicules, 4),
        frigorigenes_tco2e=round(frigorigenes, 4),
        total_tco2e=total
    )


def calculer_scope2(donnees: DonneesScope2) -> ResultatScope2:
    """
    Calcule les émissions indirectes Scope 2 (énergie).
    Formule : kWh × facteur_réseau → kgCO₂e → tCO₂e
    """
    co2e_kg  = donnees.electricite_kwh * FacteursEmission.ELECTRICITE_TUNISIE
    total    = round(co2e_kg * KG_TO_TONNES, 4)

    return ResultatScope2(
        electricite_tco2e=total,
        total_tco2e=total
    )


def calculer_scope3(donnees: DonneesScope3) -> ResultatScope3:
    """
    Calcule les émissions Scope 3 (mobilité domicile-campus).
    Formule par répondant :
        CO₂e = distance_aller × 2 × jours/semaine × semaines/an × facteur_mode
    Extrapolation si l'enquête est un échantillon de la population totale.
    """
    par_mode: dict[str, float] = {}
    total_kg = 0.0

    for rep in donnees.repondants:
        facteur = FACTEURS_MOBILITE.get(rep.mode_transport, FacteursEmission.VOITURE_SOLO)
        # Distance annuelle aller-retour
        distance_annuelle = rep.distance_aller_km * 2 * rep.jours_par_semaine * rep.semaines_par_an
        co2e_kg = distance_annuelle * facteur

        mode = rep.mode_transport
        par_mode[mode] = round(par_mode.get(mode, 0.0) + co2e_kg * KG_TO_TONNES, 4)
        total_kg += co2e_kg

    total_enquete = round(total_kg * KG_TO_TONNES, 4)
    nb_repondants = len(donnees.repondants)

    # Extrapolation à la population totale
    if donnees.population_totale and nb_repondants > 0:
        facteur_extrapolation = donnees.population_totale / nb_repondants
        total_extrapole = round(total_enquete * facteur_extrapolation, 4)
    else:
        facteur_extrapolation = 1.0
        total_extrapole = total_enquete

    return ResultatScope3(
        par_mode=par_mode,
        total_enquete_tco2e=total_enquete,
        total_extrapole_tco2e=total_extrapole,
        facteur_extrapolation=round(facteur_extrapolation, 3),
        nb_repondants=nb_repondants
    )


def calculer_bilan_carbone(
    scope1: DonneesScope1,
    scope2: DonneesScope2,
    scope3: DonneesScope3,
    nb_etudiants: Optional[int] = None,
    surface_totale_m2: Optional[float] = None,
    nb_entites: Optional[int] = None,
) -> BilanCarbone:
    """
    Calcule le bilan carbone complet (Scopes 1 + 2 + 3)
    et les ICP normalisés obligatoires.
    """
    r1 = calculer_scope1(scope1)
    r2 = calculer_scope2(scope2)
    r3 = calculer_scope3(scope3)

    total = round(r1.total_tco2e + r2.total_tco2e + r3.total_extrapole_tco2e, 4)

    return BilanCarbone(
        scope1=r1,
        scope2=r2,
        scope3=r3,
        total_tco2e=total,
        nb_etudiants=nb_etudiants,
        surface_totale_m2=surface_totale_m2,
        nb_entites=nb_entites,
    )


# ─────────────────────────────────────────────
# SIMULATEUR DE SCÉNARIOS
# ─────────────────────────────────────────────

def simuler_scenario(
    bilan_reference: BilanCarbone,
    reduction_electricite_pct: float = 0.0,
    reduction_gaz_pct: float = 0.0,
    report_modal_voiture_vers_bus_pct: float = 0.0,
) -> dict:
    """
    Simule l'impact de mesures de réduction sur le bilan carbone.

    Paramètres :
    - reduction_electricite_pct : % de réduction de la conso électrique (ex: 20 → -20%)
    - reduction_gaz_pct         : % de réduction de la conso de gaz
    - report_modal_voiture_vers_bus_pct : % de voitures solo converties en bus

    Retourne : comparaison avant/après avec réduction en tCO₂e et en %
    """
    baseline = bilan_reference.total_tco2e

    # Nouveau scope2 après réduction électricité
    nouveau_s2 = bilan_reference.scope2.total_tco2e * (1 - reduction_electricite_pct / 100)

    # Nouveau scope1 après réduction gaz
    reduction_combustion = bilan_reference.scope1.combustion_tco2e * (reduction_gaz_pct / 100)
    nouveau_s1 = bilan_reference.scope1.total_tco2e - reduction_combustion

    # Report modal : voiture → bus
    co2e_voiture = bilan_reference.scope3.par_mode.get("voiture_solo", 0.0)
    # Les émissions voiture qui passent au bus : bus = 0.029 vs voiture = 0.218 → ratio 0.133
    reduction_modal = co2e_voiture * (report_modal_voiture_vers_bus_pct / 100) * (1 - FacteursEmission.BUS / FacteursEmission.VOITURE_SOLO)
    nouveau_s3 = bilan_reference.scope3.total_extrapole_tco2e - reduction_modal

    nouveau_total = round(nouveau_s1 + nouveau_s2 + nouveau_s3, 4)
    reduction_absolue = round(baseline - nouveau_total, 4)
    reduction_pct = round((reduction_absolue / baseline) * 100, 2) if baseline > 0 else 0.0

    return {
        "baseline_tco2e": baseline,
        "simule_tco2e": nouveau_total,
        "reduction_tco2e": reduction_absolue,
        "reduction_pct": reduction_pct,
        "detail": {
            "scope1_simule": round(nouveau_s1, 4),
            "scope2_simule": round(nouveau_s2, 4),
            "scope3_simule": round(nouveau_s3, 4),
        },
        "parametres": {
            "reduction_electricite_pct": reduction_electricite_pct,
            "reduction_gaz_pct": reduction_gaz_pct,
            "report_modal_bus_pct": report_modal_voiture_vers_bus_pct,
        }
    }


# ─────────────────────────────────────────────
# TEST RAPIDE (à supprimer en production)
# ─────────────────────────────────────────────
if __name__ == "__main__":
    # Exemple de calcul avec données fictives ENSIT
    s1 = DonneesScope1(
        gaz_naturel_m3=15000,
        fioul_litres=2000,
        essence_litres=500,
        diesel_litres=800,
        refrigerant_kg=10,
        gwp_refrigerant=2088  # R-410A
    )
    s2 = DonneesScope2(electricite_kwh=450000)
    s3 = DonneesScope3(
        repondants=[
            RepondantMobilite("voiture_solo", 12, 5),
            RepondantMobilite("bus", 8, 5),
            RepondantMobilite("voiture_solo", 20, 4),
            RepondantMobilite("train", 15, 5),
            RepondantMobilite("moto", 6, 5),
        ],
        population_totale=3000
    )

    bilan = calculer_bilan_carbone(s1, s2, s3, nb_etudiants=2500, surface_totale_m2=12000, nb_entites=8)

    print("=" * 50)
    print("🌿 BILAN CARBONE ENSIT — RÉSULTATS")
    print("=" * 50)
    import json
    print(json.dumps(bilan.to_dict(), indent=2, ensure_ascii=False))

    print("\n🎭 SIMULATION — Réduction 20% électricité + 30% report modal bus")
    scenario = simuler_scenario(bilan, reduction_electricite_pct=20, report_modal_voiture_vers_bus_pct=30)
    print(json.dumps(scenario, indent=2, ensure_ascii=False))
