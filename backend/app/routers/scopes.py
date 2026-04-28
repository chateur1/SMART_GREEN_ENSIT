"""
Smart Green ENSIT — Routeurs Scope 1, 2 et 3
Saisie et consultation des données d'émissions
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from app.core.securite import get_utilisateur_actuel, require_manager_ou_admin, TokenData
from app.core.config import settings
from app.services.calculateur_carbone import (
    FacteursEmission,
    DonneesScope1, calculer_scope1,
    DonneesScope2, calculer_scope2,
    DonneesScope3, RepondantMobilite, calculer_scope3,
)


# ══════════════════════════════════════════════════════════
# SCOPE 1 — ÉMISSIONS DIRECTES
# ══════════════════════════════════════════════════════════
router_scope1 = APIRouter()

class SaisieScope1(BaseModel):
    periode_id: Optional[str] = None
    batiment_id: Optional[str] = None
    # Combustion sur site
    gaz_naturel_m3: float = Field(default=0.0, ge=0, example=15000,
        description="Consommation de gaz naturel en m³")
    fioul_litres: float = Field(default=0.0, ge=0,
        description="Consommation de fioul domestique en litres")
    # Véhicules
    essence_litres: float = Field(default=0.0, ge=0)
    diesel_litres: float = Field(default=0.0, ge=0)
    # Fluides frigorigènes
    refrigerant_kg: float = Field(default=0.0, ge=0,
        description="Quantité de fluide frigorigène rechargé en kg")
    gwp_refrigerant: float = Field(default=2088.0, ge=0,
        description="PRG du fluide (R-410A=2088, R-32=675, R-22=1810)")
    notes: Optional[str] = None


# Données de démonstration Scope 1
DONNEES_S1_DEMO = {
    "periode": settings.periode_active,
    "gaz_naturel_m3": 15200,
    "fioul_litres": 1800,
    "essence_litres": 520,
    "diesel_litres": 840,
    "refrigerant_kg": 9.5,
    "gwp_refrigerant": 2088,
    "notes": "Données issues des factures Steg-Gaz et bons de carburant"
}


@router_scope1.get("/donnees", summary="Consulter les données Scope 1 saisies")
def get_scope1(user: TokenData = Depends(get_utilisateur_actuel)):
    """Retourne les données Scope 1 pour la période en cours."""
    donnees = DonneesScope1(
        gaz_naturel_m3=DONNEES_S1_DEMO["gaz_naturel_m3"],
        fioul_litres=DONNEES_S1_DEMO["fioul_litres"],
        essence_litres=DONNEES_S1_DEMO["essence_litres"],
        diesel_litres=DONNEES_S1_DEMO["diesel_litres"],
        refrigerant_kg=DONNEES_S1_DEMO["refrigerant_kg"],
        gwp_refrigerant=DONNEES_S1_DEMO["gwp_refrigerant"],
    )
    resultat = calculer_scope1(donnees)
    return {
        "donnees_brutes": DONNEES_S1_DEMO,
        "resultats": {
            "combustion_tco2e": resultat.combustion_tco2e,
            "vehicules_tco2e": resultat.vehicules_tco2e,
            "frigorigenes_tco2e": resultat.frigorigenes_tco2e,
            "total_tco2e": resultat.total_tco2e,
        },
        "facteurs_utilises": {
            "gaz_naturel": f"{FacteursEmission.GAZ_NATUREL} kgCO₂e/m³",
            "fioul": f"{FacteursEmission.FIOUL_DOMESTIQUE} kgCO₂e/litre",
            "essence": f"{FacteursEmission.ESSENCE} kgCO₂e/litre",
            "diesel": f"{FacteursEmission.DIESEL} kgCO₂e/litre",
        }
    }

@router_scope1.post("/saisir", summary="Saisir les données Scope 1")
def saisir_scope1(
    data: SaisieScope1,
    user: TokenData = Depends(require_manager_ou_admin)
):
    """Enregistre les données d'émissions directes et retourne le calcul immédiat."""
    donnees = DonneesScope1(
        gaz_naturel_m3=data.gaz_naturel_m3,
        fioul_litres=data.fioul_litres,
        essence_litres=data.essence_litres,
        diesel_litres=data.diesel_litres,
        refrigerant_kg=data.refrigerant_kg,
        gwp_refrigerant=data.gwp_refrigerant,
    )
    resultat = calculer_scope1(donnees)
    return {
        "statut": "données enregistrées",
        "saisie_par": user.email,
        "resultats_immediats": {
            "combustion_tco2e": resultat.combustion_tco2e,
            "vehicules_tco2e": resultat.vehicules_tco2e,
            "frigorigenes_tco2e": resultat.frigorigenes_tco2e,
            "total_tco2e": resultat.total_tco2e,
        }
    }

@router_scope1.get("/guide-saisie", summary="Guide de saisie Scope 1")
def guide_scope1():
    """Retourne le guide méthodologique pour la collecte des données Scope 1."""
    return {
        "sources_recommandees": [
            {"donnee": "Gaz naturel", "source": "Factures mensuelles Steg-Gaz", "unite": "m³/an"},
            {"donnee": "Fioul domestique", "source": "Bons de commande / livraisons", "unite": "litres/an"},
            {"donnee": "Essence & diesel", "source": "Bons de carburant véhicules ENSIT", "unite": "litres/an"},
            {"donnee": "Fluides frigorigènes", "source": "Rapports de maintenance climatisation", "unite": "kg rechargés/an"},
        ],
        "fluides_frigorigenes_courants": [
            {"code": "R-410A", "gwp": 2088, "note": "Le plus répandu — à remplacer progressivement"},
            {"code": "R-32",   "gwp": 675,  "note": "Fluide de transition, GWP réduit"},
            {"code": "R-22",   "gwp": 1810, "note": "Interdit dans les nouvelles installations"},
            {"code": "R-134a", "gwp": 1430, "note": "Climatisation automobile"},
        ]
    }


# ══════════════════════════════════════════════════════════
# SCOPE 2 — ÉLECTRICITÉ
# ══════════════════════════════════════════════════════════
router_scope2 = APIRouter()

class SaisieScope2(BaseModel):
    periode_id: Optional[str] = None
    batiment_id: Optional[str] = None
    kwh_jan: float = Field(default=0, ge=0)
    kwh_fev: float = Field(default=0, ge=0)
    kwh_mar: float = Field(default=0, ge=0)
    kwh_avr: float = Field(default=0, ge=0)
    kwh_mai: float = Field(default=0, ge=0)
    kwh_jun: float = Field(default=0, ge=0)
    kwh_jul: float = Field(default=0, ge=0)
    kwh_aou: float = Field(default=0, ge=0)
    kwh_sep: float = Field(default=0, ge=0)
    kwh_oct: float = Field(default=0, ge=0)
    kwh_nov: float = Field(default=0, ge=0)
    kwh_dec: float = Field(default=0, ge=0)

    @property
    def total_kwh(self):
        return sum([self.kwh_jan, self.kwh_fev, self.kwh_mar, self.kwh_avr,
                    self.kwh_mai, self.kwh_jun, self.kwh_jul, self.kwh_aou,
                    self.kwh_sep, self.kwh_oct, self.kwh_nov, self.kwh_dec])


# Données mensuelles de démonstration
DONNEES_S2_DEMO = {
    "periode": settings.periode_active,
    "mensuel_kwh": {
        "Septembre":  38200, "Octobre": 41500, "Novembre": 43800,
        "Décembre":   45200, "Janvier": 44100, "Février":  40300,
        "Mars":       39700, "Avril":   37900, "Mai":      36400,
        "Juin":       35200, "Juillet": 33100, "Août":     24600,
    },
    "total_kwh": 460000,
    "source": f"Relevés mensuels compteurs STEG — Factures {settings.periode_active}",
    "tarif_moyen_dt_kwh": 0.285,
}


@router_scope2.get("/donnees", summary="Consulter les données Scope 2")
def get_scope2(user: TokenData = Depends(get_utilisateur_actuel)):
    """Retourne les données de consommation électrique et les émissions calculées."""
    donnees = DonneesScope2(electricite_kwh=DONNEES_S2_DEMO["total_kwh"])
    resultat = calculer_scope2(donnees)
    return {
        "donnees_brutes": DONNEES_S2_DEMO,
        "resultats": {
            "total_kwh": DONNEES_S2_DEMO["total_kwh"],
            "electricite_tco2e": resultat.electricite_tco2e,
            "total_tco2e": resultat.total_tco2e,
        },
        "facteur_reseau": {
            "valeur": FacteursEmission.ELECTRICITE_TUNISIE,
            "unite": "kgCO₂e/kWh",
            "source": "Mix électrique tunisien — Estimation STEG 2023",
        }
    }

@router_scope2.post("/saisir", summary="Saisir la consommation électrique mensuelle")
def saisir_scope2(
    data: SaisieScope2,
    user: TokenData = Depends(require_manager_ou_admin)
):
    mois_vals = [data.kwh_jan, data.kwh_fev, data.kwh_mar, data.kwh_avr,
                 data.kwh_mai, data.kwh_jun, data.kwh_jul, data.kwh_aou,
                 data.kwh_sep, data.kwh_oct, data.kwh_nov, data.kwh_dec]
    total = sum(mois_vals)
    donnees = DonneesScope2(electricite_kwh=total)
    resultat = calculer_scope2(donnees)
    return {
        "statut": "données enregistrées",
        "saisie_par": user.email,
        "total_kwh": total,
        "resultats_immediats": {"total_tco2e": resultat.total_tco2e},
    }


# ══════════════════════════════════════════════════════════
# SCOPE 3 — MOBILITÉ DOMICILE-CAMPUS
# ══════════════════════════════════════════════════════════
router_scope3 = APIRouter()

class ReponseEnquete(BaseModel):
    categorie_repondant: str = Field(..., example="etudiant",
        description="etudiant, enseignant, ou administratif")
    mode_transport: str = Field(..., example="voiture_solo",
        description="voiture_solo, covoiturage, bus, train, metro, moto, velo, marche")
    distance_km_aller: float = Field(..., gt=0, example=12.5,
        description="Distance aller en km")
    jours_par_semaine: float = Field(..., gt=0, le=7, example=5)
    semaines_par_an: int = Field(default=36, ge=1, le=52)

class SoumissionEnquete(BaseModel):
    periode_id: Optional[str] = None
    reponses: list[ReponseEnquete]
    population_totale: Optional[int] = Field(default=None,
        description="Population totale pour extrapolation (si enquête partielle)")


# Données de démonstration Scope 3
ENQUETE_DEMO = {
    "nb_repondants": 312,
    # Population réelle ENSIT : 1525 (1300 étudiants + 225 personnel)
    "population_totale": settings.population_campus_totale,
    "repartition_categories": {
        "etudiant":      268,  # élèves ingénieurs + mastériens + doctorants
        "enseignant":    32,   # enseignants permanents + contractuels
        "administratif": 12,   # personnel administratif et technique
    },
    "repartition_modes": {
        "voiture_solo": 42, "bus": 28, "moto": 18,
        "train": 7, "covoiturage": 4, "velo": 1
    },
    "periode": settings.periode_active,
}


@router_scope3.get("/donnees", summary="Résultats de l'enquête mobilité Scope 3")
def get_scope3(user: TokenData = Depends(get_utilisateur_actuel)):
    from app.services.calculateur_carbone import FacteursEmission as FE
    repondants = [
        RepondantMobilite("voiture_solo", 14.0, 5, 36),
        RepondantMobilite("voiture_solo", 18.0, 4, 36),
        RepondantMobilite("bus",          10.0, 5, 36),
        RepondantMobilite("bus",           8.0, 5, 36),
        RepondantMobilite("moto",          9.0, 5, 36),
        RepondantMobilite("train",        20.0, 5, 36),
        RepondantMobilite("covoiturage",  15.0, 4, 36),
    ] * 44  # Simulation 308 répondants
    donnees = DonneesScope3(
        repondants=repondants,
        population_totale=settings.population_campus_totale  # 1525 personnes réelles
    )
    resultat = calculer_scope3(donnees)
    return {
        "enquete": ENQUETE_DEMO,
        "resultats": {
            "par_mode_tco2e": resultat.par_mode,
            "total_enquete_tco2e": resultat.total_enquete_tco2e,
            "total_extrapole_tco2e": resultat.total_extrapole_tco2e,
            "facteur_extrapolation": resultat.facteur_extrapolation,
            "nb_repondants": resultat.nb_repondants,
        },
        "facteurs_mobilite": {
            "voiture_solo":  f"{FE.VOITURE_SOLO} kgCO₂e/km",
            "covoiturage":   f"{FE.COVOITURAGE_2P} kgCO₂e/km",
            "bus":           f"{FE.BUS} kgCO₂e/km",
            "train_metro":   f"{FE.TRAIN_METRO} kgCO₂e/km",
            "moto_scooter":  f"{FE.MOTO_SCOOTER} kgCO₂e/km",
            "velo_marche":   "0 kgCO₂e/km (mobilité douce)",
        }
    }

@router_scope3.post("/soumettre-enquete", summary="Soumettre des réponses à l'enquête mobilité")
def soumettre_enquete(data: SoumissionEnquete, user: TokenData = Depends(require_manager_ou_admin)):
    """Enregistre les réponses à l'enquête de mobilité domicile-campus."""
    repondants = [
        RepondantMobilite(
            mode_transport=r.mode_transport,
            distance_aller_km=r.distance_km_aller,
            jours_par_semaine=r.jours_par_semaine,
            semaines_par_an=r.semaines_par_an,
        )
        for r in data.reponses
    ]
    donnees = DonneesScope3(repondants=repondants, population_totale=data.population_totale)
    resultat = calculer_scope3(donnees)
    return {
        "statut": "enquête enregistrée",
        "nb_reponses": len(data.reponses),
        "calcul_immediat": {
            "total_enquete_tco2e": resultat.total_enquete_tco2e,
            "total_extrapole_tco2e": resultat.total_extrapole_tco2e,
            "par_mode": resultat.par_mode,
        }
    }

@router_scope3.get("/formulaire", summary="Formulaire d'enquête mobilité")
def get_formulaire_enquete():
    """Retourne la structure du formulaire d'enquête pour le frontend."""
    return {
        "titre": "Enquête de mobilité domicile-campus",
        "description": "Aidez-nous à calculer l'empreinte carbone liée aux déplacements en remplissant ce formulaire anonyme.",
        "champs": [
            {"id": "categorie", "label": "Vous êtes :",
             "type": "radio", "options": ["Étudiant(e)", "Enseignant(e)", "Personnel administratif"]},
            {"id": "mode_principal", "label": "Mode de transport principal :",
             "type": "radio", "options": ["Voiture individuelle", "Covoiturage", "Bus / Transport en commun",
                                           "Métro / Train", "Moto / Scooter", "Vélo", "À pied"]},
            {"id": "distance_km", "label": "Distance aller domicile-campus (km) :",
             "type": "number", "min": 0.5, "max": 200},
            {"id": "jours_semaine", "label": "Nombre de jours/semaine en présentiel :",
             "type": "select", "options": [1, 2, 3, 4, 5]},
        ]
    }
