"""
Smart Green ENSIT — Modèles ORM SQLAlchemy
Mapping Python ↔ PostgreSQL pour toutes les tables
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    ForeignKey, Text, Enum, Numeric, SmallInteger
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


# ── Enums ──────────────────────────────────────────────────────
class RoleUtilisateur(str, enum.Enum):
    admin   = "admin"
    manager = "manager"
    viewer  = "viewer"

class TypeBatiment(str, enum.Enum):
    pedagogique    = "pedagogical"
    laboratoire    = "laboratory"
    administratif  = "administrative"
    technique      = "technical"

class PorteeEmission(str, enum.Enum):
    scope1 = "scope1"
    scope2 = "scope2"
    scope3 = "scope3"

class ModeTransport(str, enum.Enum):
    voiture_solo = "voiture_solo"
    covoiturage  = "covoiturage"
    bus          = "bus"
    train        = "train"
    metro        = "metro"
    moto         = "moto"
    velo         = "velo"
    marche       = "marche"

class CategorieUsager(str, enum.Enum):
    etudiant      = "etudiant"
    enseignant    = "enseignant"
    administratif = "administratif"


# ══════════════════════════════════════════════════════════════
# UTILISATEURS
# ══════════════════════════════════════════════════════════════
class Utilisateur(Base):
    __tablename__ = "users"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email            = Column(String(255), unique=True, nullable=False, index=True)
    nom_complet      = Column(String(255), nullable=False)
    hashed_password  = Column(Text, nullable=False)
    role             = Column(Enum(RoleUtilisateur), nullable=False, default=RoleUtilisateur.viewer)
    est_actif        = Column(Boolean, nullable=False, default=True)
    cree_le          = Column(DateTime(timezone=True), server_default=func.now())
    modifie_le       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Utilisateur {self.email} ({self.role})>"


# ══════════════════════════════════════════════════════════════
# BÂTIMENTS & ENTITÉS
# ══════════════════════════════════════════════════════════════
class Batiment(Base):
    __tablename__ = "buildings"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom            = Column(String(255), nullable=False)
    code           = Column(String(50), unique=True, nullable=False)
    type_batiment  = Column(Enum(TypeBatiment), nullable=False)
    surface_m2     = Column(Numeric(10, 2))
    nb_etages      = Column(SmallInteger)
    annee_construction = Column(SmallInteger)
    est_actif      = Column(Boolean, nullable=False, default=True)
    cree_le        = Column(DateTime(timezone=True), server_default=func.now())

    entites = relationship("Entite", back_populates="batiment")

    def __repr__(self):
        return f"<Batiment {self.code} - {self.nom}>"


class Entite(Base):
    __tablename__ = "entities"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom         = Column(String(255), nullable=False)
    code        = Column(String(50), unique=True, nullable=False)
    batiment_id = Column(UUID(as_uuid=True), ForeignKey("buildings.id"))
    nb_personnes = Column(Integer)
    est_actif   = Column(Boolean, nullable=False, default=True)
    cree_le     = Column(DateTime(timezone=True), server_default=func.now())

    batiment = relationship("Batiment", back_populates="entites")


# ══════════════════════════════════════════════════════════════
# FACTEURS D'ÉMISSION
# ══════════════════════════════════════════════════════════════
class FacteurEmission(Base):
    __tablename__ = "emission_factors"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categorie    = Column(String(100), nullable=False)
    portee       = Column(Enum(PorteeEmission), nullable=False)
    libelle      = Column(String(255), nullable=False)
    valeur       = Column(Numeric(12, 6), nullable=False)
    unite        = Column(String(50), nullable=False)
    source       = Column(String(255))
    notes        = Column(Text)
    valide_depuis = Column(DateTime(timezone=True), server_default=func.now())
    est_actif    = Column(Boolean, nullable=False, default=True)


# ══════════════════════════════════════════════════════════════
# PÉRIODES DE REPORTING
# ══════════════════════════════════════════════════════════════
class PeriodeReporting(Base):
    __tablename__ = "reporting_periods"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    libelle     = Column(String(255), nullable=False)
    date_debut  = Column(DateTime(timezone=True), nullable=False)
    date_fin    = Column(DateTime(timezone=True), nullable=False)
    est_active  = Column(Boolean, nullable=False, default=True)
    cree_le     = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    donnees_scope1     = relationship("DonneesScope1Combustible", back_populates="periode")
    donnees_scope2     = relationship("DonneesScope2Electricite", back_populates="periode")
    enquetes_scope3    = relationship("EnqueteMobiliteScope3", back_populates="periode")
    bilan_carbone      = relationship("BilanCarbone", back_populates="periode", uselist=False)


# ══════════════════════════════════════════════════════════════
# SCOPE 1 — ÉMISSIONS DIRECTES
# ══════════════════════════════════════════════════════════════
class DonneesScope1Combustible(Base):
    __tablename__ = "scope1_fuel_consumption"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    periode_id           = Column(UUID(as_uuid=True), ForeignKey("reporting_periods.id"), nullable=False)
    batiment_id          = Column(UUID(as_uuid=True), ForeignKey("buildings.id"))
    categorie            = Column(String(100), nullable=False)  # fuel_combustion, company_vehicles, refrigerant_leaks
    type_combustible     = Column(String(100), nullable=False)  # gaz_naturel, fioul, essence, diesel, refrigerant
    quantite             = Column(Numeric(14, 3), nullable=False)
    unite                = Column(String(50), nullable=False)   # m3, litre, kg
    facteur_emission_id  = Column(UUID(as_uuid=True), ForeignKey("emission_factors.id"))
    co2e_kg              = Column(Numeric(14, 3))               # calculé automatiquement
    notes                = Column(Text)
    saisie_le            = Column(DateTime(timezone=True), server_default=func.now())
    saisie_par           = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    periode = relationship("PeriodeReporting", back_populates="donnees_scope1")


# ══════════════════════════════════════════════════════════════
# SCOPE 2 — ÉLECTRICITÉ
# ══════════════════════════════════════════════════════════════
class DonneesScope2Electricite(Base):
    __tablename__ = "scope2_electricity"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    periode_id          = Column(UUID(as_uuid=True), ForeignKey("reporting_periods.id"), nullable=False)
    batiment_id         = Column(UUID(as_uuid=True), ForeignKey("buildings.id"))
    mois                = Column(SmallInteger)           # 1-12
    kwh_consommes       = Column(Numeric(14, 3), nullable=False)
    facteur_emission_id = Column(UUID(as_uuid=True), ForeignKey("emission_factors.id"))
    co2e_kg             = Column(Numeric(14, 3))
    source_donnee       = Column(String(100))            # facture, estimation, compteur
    notes               = Column(Text)
    saisie_le           = Column(DateTime(timezone=True), server_default=func.now())
    saisie_par          = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    periode = relationship("PeriodeReporting", back_populates="donnees_scope2")


# ══════════════════════════════════════════════════════════════
# SCOPE 3 — MOBILITÉ DOMICILE-CAMPUS
# ══════════════════════════════════════════════════════════════
class EnqueteMobiliteScope3(Base):
    __tablename__ = "scope3_commuting_surveys"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    periode_id            = Column(UUID(as_uuid=True), ForeignKey("reporting_periods.id"), nullable=False)
    categorie_repondant   = Column(Enum(CategorieUsager), nullable=False)
    mode_transport        = Column(Enum(ModeTransport), nullable=False)
    distance_km_aller     = Column(Numeric(8, 2), nullable=False)
    jours_par_semaine     = Column(Numeric(3, 1), nullable=False)
    semaines_par_an       = Column(SmallInteger, nullable=False, default=36)
    facteur_emission_id   = Column(UUID(as_uuid=True), ForeignKey("emission_factors.id"))
    co2e_kg               = Column(Numeric(12, 3))
    est_anonyme           = Column(Boolean, default=True)
    soumis_le             = Column(DateTime(timezone=True), server_default=func.now())

    periode = relationship("PeriodeReporting", back_populates="enquetes_scope3")


# ══════════════════════════════════════════════════════════════
# BILAN CARBONE CONSOLIDÉ
# ══════════════════════════════════════════════════════════════
class BilanCarbone(Base):
    __tablename__ = "carbon_balance"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    periode_id      = Column(UUID(as_uuid=True), ForeignKey("reporting_periods.id"), unique=True, nullable=False)

    # Scope 1 (tCO2e)
    s1_combustion_tco2e   = Column(Numeric(12, 3), default=0)
    s1_vehicules_tco2e    = Column(Numeric(12, 3), default=0)
    s1_frigorigenes_tco2e = Column(Numeric(12, 3), default=0)
    scope1_total_tco2e    = Column(Numeric(12, 3), default=0)

    # Scope 2 (tCO2e)
    scope2_total_tco2e    = Column(Numeric(12, 3), default=0)

    # Scope 3 (tCO2e)
    scope3_total_tco2e    = Column(Numeric(12, 3), default=0)
    scope3_nb_repondants  = Column(Integer)
    scope3_facteur_extra  = Column(Numeric(6, 3), default=1.0)

    # Grand total
    grand_total_tco2e     = Column(Numeric(12, 3), default=0)

    # ICP normalisés obligatoires
    nb_etudiants          = Column(Integer)
    surface_totale_m2     = Column(Numeric(12, 2))
    nb_entites            = Column(Integer)
    kpi_tco2e_par_etudiant = Column(Numeric(10, 4))
    kpi_tco2e_par_m2       = Column(Numeric(10, 4))
    kpi_tco2e_par_entite   = Column(Numeric(10, 4))

    # Métadonnées
    calcule_le    = Column(DateTime(timezone=True), server_default=func.now())
    calcule_par   = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    est_valide    = Column(Boolean, default=False)
    notes_validation = Column(Text)

    periode = relationship("PeriodeReporting", back_populates="bilan_carbone")


# ══════════════════════════════════════════════════════════════
# SCÉNARIOS DE SIMULATION
# ══════════════════════════════════════════════════════════════
class Scenario(Base):
    __tablename__ = "scenarios"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom             = Column(String(255), nullable=False)
    description     = Column(Text)
    periode_base_id = Column(UUID(as_uuid=True), ForeignKey("reporting_periods.id"), nullable=False)
    parametres      = Column(JSONB)           # {reduction_elec: 20, report_modal: 30, ...}
    resultats       = Column(JSONB)           # résultats calculés
    cree_par        = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    cree_le         = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Scenario {self.nom}>"
