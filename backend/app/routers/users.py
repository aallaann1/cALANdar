from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User, Invitation, Team, Event
from app.schemas import UserUpdate, UserRolesUpdate, User as UserSchema
from app.auth import get_current_user, get_current_admin
from app.core.security import create_access_token
from datetime import datetime

router = APIRouter()

@router.get("/accept-invite")
def accept_invite(token: str, db: Session = Depends(get_db)):
    invitation = db.query(Invitation).filter(Invitation.token == token).first()
    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid token")
    if invitation.used:
        raise HTTPException(status_code=400, detail="Token already used")
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")
    
    db_user = db.query(User).filter(User.email == invitation.email).first()
    if not db_user:
        new_user = User(
            email=invitation.email,
            team_id=invitation.team_id,
            is_manager=False,
            is_admin=False
        )
        db.add(new_user)
    else:
        db_user.team_id = invitation.team_id

    invitation.used = True
    db.commit()
    
    return {"message": "Vous avez bien été ajouté à l'équipe."}

@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserSchema)
def update_user_me(user_in: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # With Google login, we might not let them edit this, but API route can remain
    if user_in.first_name:
        current_user.first_name = user_in.first_name
    if user_in.last_name:
        current_user.last_name = user_in.last_name
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/", response_model=list[UserSchema])
def read_all_users(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return db.query(User).order_by(User.id.asc()).all()

@router.put("/{user_id}/toggle-block", response_model=UserSchema)
def toggle_block_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas bloquer votre propre compte administrateur.")
    
    target_user.is_blocked = not bool(target_user.is_blocked)
    # If now blocked, invalidate all active sessions immediately
    if target_user.is_blocked:
        target_user.token_version = (target_user.token_version or 0) + 1
    db.commit()
    db.refresh(target_user)
    return target_user

@router.post("/{user_id}/disconnect")
def disconnect_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    target_user.token_version = (target_user.token_version or 0) + 1
    db.commit()
    return {"message": f"Toutes les sessions de {target_user.email} ont été révoquées avec succès."}

@router.put("/{user_id}/roles", response_model=UserSchema)
def update_user_roles(user_id: int, roles_in: UserRolesUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if roles_in.discord_role is not None:
        target_user.discord_role = roles_in.discord_role
    if roles_in.is_manager is not None:
        target_user.is_manager = roles_in.is_manager
        
    db.commit()
    db.refresh(target_user)
    return target_user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte administrateur.")
    
    # Delete associated events first
    db.query(Event).filter(Event.user_id == target_user.id).delete()
    db.delete(target_user)
    db.commit()
    return {"message": "Utilisateur supprimé totalement avec succès."}

@router.post("/{user_id}/impersonate")
def impersonate_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if bool(target_user.is_blocked):
        raise HTTPException(status_code=400, detail="Impossible de se connecter à la place d'un utilisateur bloqué.")
    
    token = create_access_token(data={
        "sub": target_user.email,
        "token_version": target_user.token_version or 0,
        "impersonated_by": admin.email
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "first_name": target_user.first_name,
            "last_name": target_user.last_name
        }
    }
