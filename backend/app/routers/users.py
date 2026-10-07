from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User, Invitation, Team
from app.schemas import UserUpdate, User as UserSchema
from app.auth import get_current_user, get_current_admin
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
    return db.query(User).all()
