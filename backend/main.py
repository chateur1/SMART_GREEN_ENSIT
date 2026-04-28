"""
Smart Green ENSIT — Point d'entrée principal de l'API
Version complète avec tous les routeurs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers.auth import router as router_auth
from app.routers.buildings import router as router_buildings
from app.routers.scopes import router_scope1, router_scope2, router_scope3
from app.routers.carbon import router as router_carbon
from app.routers.analyse_ia import router as router_ia
from app.routers.scenarios_export import router_scenarios, router_export

app = FastAPI(
    title="🌿 Smart Green ENSIT — API",
    description="Plateforme de calcul et suivi de l'empreinte carbone du campus ENSIT",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting — protection bruteforce
# from slowapi import Limiter
# from slowapi.util import get_remote_address
# limiter = Limiter(key_func=get_remote_address)
# app.state.limiter = limiter
# Décorer /api/auth/connexion avec @limiter.limit("10/minute")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router_auth,      prefix="/api/auth",        tags=["Authentification"])
app.include_router(router_buildings, prefix="/api/batiments",   tags=["Bâtiments"])
app.include_router(router_scope1,    prefix="/api/scope1",      tags=["Scope 1"])
app.include_router(router_scope2,    prefix="/api/scope2",      tags=["Scope 2"])
app.include_router(router_scope3,    prefix="/api/scope3",      tags=["Scope 3"])
app.include_router(router_carbon,    prefix="/api/bilan",       tags=["Bilan Carbone"])
app.include_router(router_ia,        prefix="/api/ia",          tags=["Intelligence Artificielle"])
app.include_router(router_scenarios, prefix="/api/scenarios",   tags=["Scenarios"])
app.include_router(router_export,    prefix="/api/export",      tags=["Export"])

@app.get("/")
def accueil():
    return {"plateforme": "Smart Green ENSIT", "version": settings.app_version, "docs": "/docs"}

@app.get("/sante")
def sante():
    return {"statut": "ok", "service": settings.app_name}

@app.get("/config/periode")
def get_periode():
    """Endpoint public — retourne la période de reporting active et les stats campus."""
    return {
        "periode":      settings.periode_active,
        "annee_debut":  settings.annee_debut,
        "annee_fin":    settings.annee_fin,
        "historique":   settings.historique_annees,
        "source":       "ANNEE_REPORTING (.env)" if settings.annee_reporting else "Calcul automatique",
        "campus": {
            # Apprenants
            "nb_eleves_ingenieurs":  settings.nb_eleves_ingenieurs,
            "nb_masteriens":         settings.nb_masteriens,
            "nb_doctorants":         settings.nb_doctorants,
            "nb_etudiants_total":    settings.nb_etudiants_total,
            "nb_diplomes_par_an":    settings.nb_diplomes_par_an,
            # Personnel
            "nb_enseignants_permanents":   settings.nb_enseignants_permanents,
            "nb_enseignants_total":        settings.nb_enseignants_total,
            "nb_personnel_total":          settings.nb_personnel_total,
            "corps_a_pct":                 settings.corps_a_pct,
            "nb_techniciens":              settings.nb_techniciens,
            "nb_administratifs":           settings.nb_administratifs,
            # Structure
            "nb_departements":             settings.nb_departements_enseignement,
            "nb_structures_recherche":     settings.nb_structures_recherche,
            "nb_entites_total":            settings.nb_entites_total,
            "surface_campus_m2":           settings.surface_campus_m2,
            # Totaux pour calculs
            "population_campus_totale":    settings.population_campus_totale,
        }
    }
