"""
Smart Green ENSIT — Configuration centralisée
Lit les variables depuis .env via pydantic-settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
from datetime import datetime


class Settings(BaseSettings):
    # Application
    app_name: str = "Smart Green ENSIT"
    app_version: str = "1.0.0"
    environment: str = "development"

    # Base de données
    database_url: str = "postgresql://sge_user:sge_pass_2026@localhost:5432/smart_green"

    # Sécurité JWT
    secret_key: str = "changez-moi-en-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # CORS — Frontend
    frontend_url: str = "http://localhost:3000"

    # ── Période de reporting (dynamique) ──────────────────
    annee_reporting: str = ""

    # Email (optionnel)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

    # ════════════════════════════════════════════════════
    # DONNÉES RÉELLES ENSIT
    # Modifier dans .env pour mettre à jour sans toucher au code
    # ════════════════════════════════════════════════════

    # Apprenants
    nb_eleves_ingenieurs: int    = 930
    nb_masteriens: int           = 120
    nb_doctorants: int           = 250
    nb_diplomes_par_an: int      = 250

    # Personnel enseignant
    nb_enseignants_permanents:   int = 150
    nb_enseignants_contractuels: int = 8
    nb_enseignants_vacataires:   int = 11
    nb_enseignants_experts:      int = 2
    corps_a_pct: int             = 32   # % professeurs + maîtres de conf

    # Personnel technique et administratif
    nb_ingenieurs:    int = 2
    nb_techniciens:   int = 10
    nb_administratifs: int = 42

    # Structure organisationnelle
    nb_structures_recherche:     int = 7
    nb_departements_enseignement: int = 6

    # Infrastructure
    surface_campus_m2: float = 11100.0  # à affiner si disponible

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def periode_active(self) -> str:
        if self.annee_reporting:
            return self.annee_reporting
        now = datetime.now()
        if now.month >= 9:
            return f"{now.year}-{now.year + 1}"
        return f"{now.year - 1}-{now.year}"

    @property
    def annee_debut(self) -> int:
        try:
            return int(self.periode_active.split("-")[0])
        except (ValueError, IndexError):
            return datetime.now().year

    @property
    def annee_fin(self) -> int:
        try:
            return int(self.periode_active.split("-")[1])
        except (ValueError, IndexError):
            return datetime.now().year + 1

    @property
    def historique_annees(self) -> list[int]:
        fin = self.annee_fin
        return list(range(fin - 4, fin + 1))

    # ── Totaux calculés ─────────────────────────────────
    @property
    def nb_etudiants_total(self) -> int:
        """Total apprenants présents sur le campus"""
        return self.nb_eleves_ingenieurs + self.nb_masteriens + self.nb_doctorants

    @property
    def nb_personnel_total(self) -> int:
        """Total personnel enseignant + administratif + technique"""
        return (
            self.nb_enseignants_permanents +
            self.nb_enseignants_contractuels +
            self.nb_enseignants_vacataires +
            self.nb_enseignants_experts +
            self.nb_ingenieurs +
            self.nb_techniciens +
            self.nb_administratifs
        )

    @property
    def nb_enseignants_total(self) -> int:
        return (
            self.nb_enseignants_permanents +
            self.nb_enseignants_contractuels +
            self.nb_enseignants_vacataires +
            self.nb_enseignants_experts
        )

    @property
    def population_campus_totale(self) -> int:
        """Population totale présente sur le campus (étudiants + personnel)"""
        return self.nb_etudiants_total + self.nb_personnel_total

    @property
    def nb_entites_total(self) -> int:
        """Structures de recherche + Départements d'enseignement"""
        return self.nb_structures_recherche + self.nb_departements_enseignement

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
