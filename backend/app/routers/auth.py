"""
Smart Green ENSIT — Routeur d'authentification + Gestion des comptes
Routes : connexion, profil, rafraîchissement, CRUD utilisateurs (admin)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.core.securite import (
    authentifier_utilisateur, creer_access_token, creer_refresh_token,
    decoder_token, Token, get_utilisateur_actuel, require_admin,
    TokenData, obtenir_utilisateur, lister_utilisateurs, creer_utilisateur,
    modifier_utilisateur, changer_mot_de_passe, supprimer_utilisateur,
    compter_utilisateurs,
)

router = APIRouter()


# ── Schémas ───────────────────────────────────────────────────
class ConnexionRequest(BaseModel):
    email: EmailStr
    mot_de_passe: str

class RefreshRequest(BaseModel):
    refresh_token: str

class CreerCompteRequest(BaseModel):
    email:       EmailStr
    nom_complet: str
    mot_de_passe: str
    role:        str  # admin | manager | viewer

    @field_validator("role")
    @classmethod
    def valider_role(cls, v):
        if v not in ["admin", "manager", "viewer"]:
            raise ValueError("Rôle invalide — valeurs acceptées : admin, manager, viewer")
        return v

    @field_validator("mot_de_passe")
    @classmethod
    def valider_mdp(cls, v):
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v

    @field_validator("nom_complet")
    @classmethod
    def valider_nom(cls, v):
        if len(v.strip()) < 3:
            raise ValueError("Le nom doit contenir au moins 3 caractères")
        return v.strip()

class ModifierCompteRequest(BaseModel):
    nom_complet: Optional[str] = None
    role:        Optional[str] = None
    actif:       Optional[bool] = None

    @field_validator("role")
    @classmethod
    def valider_role(cls, v):
        if v is not None and v not in ["admin", "manager", "viewer"]:
            raise ValueError("Rôle invalide")
        return v

class ChangerMdpRequest(BaseModel):
    nouveau_mot_de_passe: str

    @field_validator("nouveau_mot_de_passe")
    @classmethod
    def valider_mdp(cls, v):
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v

class ChangerMonMdpRequest(BaseModel):
    ancien_mot_de_passe:  str
    nouveau_mot_de_passe: str

    @field_validator("nouveau_mot_de_passe")
    @classmethod
    def valider_mdp(cls, v):
        if len(v) < 8:
            raise ValueError("Le nouveau mot de passe doit contenir au moins 8 caractères")
        return v


# ════════════════════════════════════════════════════════════
# AUTHENTIFICATION
# ════════════════════════════════════════════════════════════
@router.post("/connexion", response_model=Token, summary="Connexion utilisateur")
def connexion(req: ConnexionRequest):
    """Authentifie un utilisateur et retourne les tokens JWT."""
    utilisateur = authentifier_utilisateur(req.email, req.mot_de_passe)
    if not utilisateur:
        raise HTTPException(
            status_code=401,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not utilisateur["actif"]:
        raise HTTPException(status_code=403, detail="Ce compte est désactivé. Contactez l'administrateur.")
    payload = {"sub": utilisateur["email"], "role": utilisateur["role"]}
    return Token(
        access_token=creer_access_token(payload),
        refresh_token=creer_refresh_token(payload),
        role=utilisateur["role"],
        nom_complet=utilisateur["nom_complet"],
    )

@router.post("/rafraichir", summary="Rafraîchir le token d'accès")
def rafraichir_token(req: RefreshRequest):
    """Génère un nouvel access token depuis le refresh token."""
    # FIX: vérifier que c'est bien un refresh token
    td = decoder_token(req.refresh_token, expected_type="refresh")
    u  = obtenir_utilisateur(td.email)
    if not u:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    payload = {"sub": u["email"], "role": u["role"]}
    return {"access_token": creer_access_token(payload), "token_type": "bearer"}

@router.get("/moi", summary="Profil de l'utilisateur connecté")
def mon_profil(user: TokenData = Depends(get_utilisateur_actuel)):
    """Retourne les informations du compte connecté."""
    u = obtenir_utilisateur(user.email)
    return {
        "id":         u["id"],
        "email":      u["email"],
        "nom_complet": u["nom_complet"],
        "role":       u["role"],
        "cree_le":    u["cree_le"],
    }

@router.post("/changer-mon-mot-de-passe", summary="Changer son propre mot de passe")
def changer_mon_mdp(
    req: ChangerMonMdpRequest,
    user: TokenData = Depends(get_utilisateur_actuel),
):
    """Permet à n'importe quel utilisateur connecté de changer son mot de passe."""
    u = obtenir_utilisateur(user.email)
    from app.core.securite import verifier_mot_de_passe
    if not verifier_mot_de_passe(req.ancien_mot_de_passe, u["hashed_password"]):
        raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect")
    try:
        changer_mot_de_passe(user.email, req.nouveau_mot_de_passe)
        return {"statut": "Mot de passe mis à jour avec succès"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/comptes-demo", summary="Comptes de démonstration")
def comptes_demo():
    return {
        "comptes": [
            {"email": "admin@ensit.tn",        "mot_de_passe": "Admin2026!", "role": "admin",   "acces": "Accès complet"},
            {"email": "gestionnaire@ensit.tn",  "mot_de_passe": "Gest2026!", "role": "manager", "acces": "Saisie + visualisation"},
            {"email": "lecteur@ensit.tn",       "mot_de_passe": "Lect2026!", "role": "viewer",  "acces": "Lecture seule"},
        ]
    }




@router.post("/inscription", summary="Créer son compte (inscription publique)", status_code=201)
def inscription(req: CreerCompteRequest):
    """
    Inscription publique — accessible sans authentification.
    Le rôle est automatiquement fixé à 'viewer' pour la sécurité.
    Un administrateur peut ensuite promouvoir le compte si nécessaire.
    """
    try:
        nouvel_user = creer_utilisateur(
            email=req.email,
            nom_complet=req.nom_complet,
            mdp=req.mot_de_passe,
            role="viewer",
            cree_par="auto-inscription",
        )
        # Connexion automatique juste après l'inscription
        payload = {"sub": nouvel_user["email"], "role": nouvel_user["role"]}
        return {
            "statut":        "Compte créé avec succès",
            "utilisateur":   nouvel_user,
            "access_token":  creer_access_token(payload),
            "refresh_token": creer_refresh_token(payload),
            "token_type":    "bearer",
            "role":          nouvel_user["role"],
            "nom_complet":   nouvel_user["nom_complet"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ════════════════════════════════════════════════════════════
# GESTION DES COMPTES — RÉSERVÉ ADMIN
# ════════════════════════════════════════════════════════════
@router.get("/utilisateurs", summary="Lister tous les comptes utilisateurs")
def lister_comptes(admin: TokenData = Depends(require_admin)):
    """
    Retourne la liste complète des utilisateurs avec leurs statistiques.
    Accès réservé aux administrateurs.
    """
    users = lister_utilisateurs()
    stats = compter_utilisateurs()
    return {
        "stats":        stats,
        "utilisateurs": users,
    }

@router.post("/utilisateurs", summary="Créer un nouveau compte utilisateur", status_code=201)
def creer_compte(
    req: CreerCompteRequest,
    admin: TokenData = Depends(require_admin),
):
    """
    Crée un nouveau compte utilisateur.
    Accès réservé aux administrateurs.
    """
    try:
        nouvel_user = creer_utilisateur(
            email=req.email,
            nom_complet=req.nom_complet,
            mdp=req.mot_de_passe,
            role=req.role,
            cree_par=admin.email,
        )
        return {
            "statut":      "Compte créé avec succès",
            "utilisateur": nouvel_user,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/utilisateurs/{email}", summary="Détails d'un compte utilisateur")
def detail_compte(email: str, admin: TokenData = Depends(require_admin)):
    """Retourne les détails d'un utilisateur par son email."""
    u = obtenir_utilisateur(email)
    if not u:
        raise HTTPException(status_code=404, detail=f"Utilisateur introuvable : {email}")
    return {k: v for k, v in u.items() if k != "hashed_password"}

@router.put("/utilisateurs/{email}", summary="Modifier un compte utilisateur")
def modifier_compte(
    email: str,
    req: ModifierCompteRequest,
    admin: TokenData = Depends(require_admin),
):
    """
    Modifie le nom, le rôle ou le statut d'un utilisateur.
    Accès réservé aux administrateurs.
    """
    # Empêcher l'admin de se désactiver lui-même
    if email == admin.email and req.actif is False:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas désactiver votre propre compte")
    try:
        user_maj = modifier_utilisateur(
            email=email,
            nom_complet=req.nom_complet,
            role=req.role,
            actif=req.actif,
        )
        return {"statut": "Compte mis à jour", "utilisateur": user_maj}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/utilisateurs/{email}/reinitialiser-mdp", summary="Réinitialiser le mot de passe d'un utilisateur")
def reinitialiser_mdp(
    email: str,
    req: ChangerMdpRequest,
    admin: TokenData = Depends(require_admin),
):
    """
    Réinitialise le mot de passe d'un utilisateur.
    Accès réservé aux administrateurs.
    """
    try:
        changer_mot_de_passe(email, req.nouveau_mot_de_passe)
        return {"statut": f"Mot de passe réinitialisé pour {email}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/utilisateurs/{email}", summary="Désactiver un compte utilisateur")
def desactiver_compte(email: str, admin: TokenData = Depends(require_admin)):
    """
    Désactive (soft delete) un compte utilisateur.
    Le compte n'est pas supprimé physiquement — il peut être réactivé.
    """
    if email == admin.email:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas désactiver votre propre compte")
    try:
        supprimer_utilisateur(email)
        return {"statut": f"Compte {email} désactivé"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/utilisateurs/{email}/reactiver", summary="Réactiver un compte désactivé")
def reactiver_compte(email: str, admin: TokenData = Depends(require_admin)):
    """Réactive un compte précédemment désactivé."""
    try:
        user_maj = modifier_utilisateur(email=email, actif=True)
        return {"statut": f"Compte {email} réactivé", "utilisateur": user_maj}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/statistiques", summary="Statistiques des comptes utilisateurs")
def statistiques_comptes(admin: TokenData = Depends(require_admin)):
    """Retourne les statistiques globales des comptes."""
    return compter_utilisateurs()
