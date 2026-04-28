"""
Smart Green ENSIT — Connexion base de données SQLAlchemy
Fournit le moteur, la session et la base déclarative ORM
"""
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# ── Moteur SQLAlchemy ────────────────────────────────
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # Vérifie la connexion avant utilisation
    pool_size=10,             # Connexions simultanées maintenues
    max_overflow=20,          # Connexions supplémentaires autorisées
    echo=(settings.environment == "development"),  # Log SQL en dev
)

# ── Session factory ───────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ── Base déclarative pour les modèles ORM ─────────────
Base = declarative_base()


# ── Dépendance FastAPI (injection dans les routes) ────
def get_db():
    """
    Générateur de session DB.
    Utilisation dans les routes FastAPI :
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialise les tables (uniquement si elles n'existent pas).
    À appeler au démarrage de l'application.
    """
    from app.models import user, building, emission_factor, reporting_period
    from app.models import scope1, scope2, scope3, carbon_balance, scenario
    Base.metadata.create_all(bind=engine)
