"""
Smart Green ENSIT — Système d'authentification JWT
Gestion des tokens, hachage des mots de passe, rôles utilisateurs
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import uuid
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

SECRET_KEY                  = settings.secret_key
ALGORITHM                   = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS   = settings.refresh_token_expire_days

# ── Avertissement si clé par défaut ──────────────────────
if SECRET_KEY == "changez-moi-en-production":
    logger.warning(
        "⚠️  SECRET_KEY par défaut détectée ! "
        "Définissez SECRET_KEY dans votre .env pour la production."
    )

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/connexion")


# ── Schémas ──────────────────────────────────────────────────
class TokenData(BaseModel):
    email: Optional[str] = None
    role:  Optional[str] = None

class Token(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    role:          str
    nom_complet:   str


# ── Fonctions JWT ─────────────────────────────────────────────
def hacher_mot_de_passe(mdp: str) -> str:
    return pwd_context.hash(mdp)

def verifier_mot_de_passe(mdp: str, hash: str) -> bool:
    return pwd_context.verify(mdp, hash)

def creer_access_token(data: dict, expire_delta=None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expire_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def creer_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decoder_token(token: str, expected_type: str = "access") -> TokenData:
    """
    Décode un token JWT et vérifie son type.
    BUG CORRIGÉ : vérification que le token est bien du type attendu
    (empêche l'utilisation d'un refresh token comme access token).
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        role  = payload.get("role")
        token_type = payload.get("type")

        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide : sujet manquant")

        # FIX : vérifier le type du token
        if token_type != expected_type:
            raise HTTPException(
                status_code=401,
                detail=f"Type de token invalide : attendu '{expected_type}', reçu '{token_type}'"
            )

        return TokenData(email=email, role=role)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expiré ou invalide")


# ── Stockage utilisateurs en mémoire ─────────────────────────
def _now():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

UTILISATEURS: dict = {
    "admin@ensit.tn": {
        "id": str(uuid.uuid4()), "email": "admin@ensit.tn",
        "nom_complet": "Administrateur ENSIT",
        "hashed_password": hacher_mot_de_passe("Admin2026!"),
        "role": "admin", "actif": True,
        "cree_le": _now(), "cree_par": "système",
    },
    "gestionnaire@ensit.tn": {
        "id": str(uuid.uuid4()), "email": "gestionnaire@ensit.tn",
        "nom_complet": "Gestionnaire Campus",
        "hashed_password": hacher_mot_de_passe("Gest2026!"),
        "role": "manager", "actif": True,
        "cree_le": _now(), "cree_par": "système",
    },
    "lecteur@ensit.tn": {
        "id": str(uuid.uuid4()), "email": "lecteur@ensit.tn",
        "nom_complet": "Lecteur Rapport",
        "hashed_password": hacher_mot_de_passe("Lect2026!"),
        "role": "viewer", "actif": True,
        "cree_le": _now(), "cree_par": "système",
    },
}

def _sans_hash(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "hashed_password"}

def obtenir_utilisateur(email: str) -> Optional[dict]:
    return UTILISATEURS.get(email.lower().strip() if email else "")

def authentifier_utilisateur(email: str, mdp: str) -> Optional[dict]:
    u = obtenir_utilisateur(email)
    if not u or not verifier_mot_de_passe(mdp, u["hashed_password"]):
        return None
    return u

def lister_utilisateurs() -> list:
    return [_sans_hash(u) for u in UTILISATEURS.values()]

def creer_utilisateur(email: str, nom_complet: str, mdp: str, role: str, cree_par: str) -> dict:
    email = email.lower().strip()
    if email in UTILISATEURS:
        raise ValueError(f"L'adresse {email} est déjà utilisée")
    if role not in ["admin", "manager", "viewer"]:
        raise ValueError("Rôle invalide — valeurs : admin, manager, viewer")
    if len(mdp) < 8:
        raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
    if len(nom_complet.strip()) < 3:
        raise ValueError("Le nom doit contenir au moins 3 caractères")
    u = {
        "id": str(uuid.uuid4()), "email": email,
        "nom_complet": nom_complet.strip(),
        "hashed_password": hacher_mot_de_passe(mdp),
        "role": role, "actif": True,
        "cree_le": _now(), "cree_par": cree_par,
    }
    UTILISATEURS[email] = u
    return _sans_hash(u)

def modifier_utilisateur(email: str, nom_complet=None, role=None, actif=None) -> dict:
    email = email.lower().strip()
    u = UTILISATEURS.get(email)
    if not u:
        raise ValueError(f"Utilisateur introuvable : {email}")
    if nom_complet is not None:
        if len(nom_complet.strip()) < 3:
            raise ValueError("Le nom doit contenir au moins 3 caractères")
        u["nom_complet"] = nom_complet.strip()
    if role is not None:
        if role not in ["admin", "manager", "viewer"]:
            raise ValueError(f"Rôle invalide : {role}")
        u["role"] = role
    if actif is not None:
        u["actif"] = actif
    UTILISATEURS[email] = u
    return _sans_hash(u)

def changer_mot_de_passe(email: str, nouveau_mdp: str) -> bool:
    email = email.lower().strip()
    u = UTILISATEURS.get(email)
    if not u:
        raise ValueError(f"Utilisateur introuvable : {email}")
    if len(nouveau_mdp) < 8:
        raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
    UTILISATEURS[email]["hashed_password"] = hacher_mot_de_passe(nouveau_mdp)
    return True

def supprimer_utilisateur(email: str) -> bool:
    email = email.lower().strip()
    if email not in UTILISATEURS:
        raise ValueError(f"Utilisateur introuvable : {email}")
    UTILISATEURS[email]["actif"] = False
    return True

def compter_utilisateurs() -> dict:
    u = list(UTILISATEURS.values())
    return {
        "total": len(u), "actifs": sum(1 for x in u if x["actif"]),
        "inactifs": sum(1 for x in u if not x["actif"]),
        "admins": sum(1 for x in u if x["role"] == "admin"),
        "managers": sum(1 for x in u if x["role"] == "manager"),
        "viewers": sum(1 for x in u if x["role"] == "viewer"),
    }


# ── Guards FastAPI ────────────────────────────────────────────
async def get_utilisateur_actuel(token: str = Depends(oauth2_scheme)) -> TokenData:
    # FIX : vérifier explicitement le type "access"
    td = decoder_token(token, expected_type="access")
    u  = obtenir_utilisateur(td.email)
    if not u or not u["actif"]:
        raise HTTPException(status_code=401, detail="Utilisateur inactif ou introuvable")
    return td

async def require_admin(user: TokenData = Depends(get_utilisateur_actuel)) -> TokenData:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user

async def require_manager_ou_admin(user: TokenData = Depends(get_utilisateur_actuel)) -> TokenData:
    if user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Accès réservé aux gestionnaires et administrateurs")
    return user
