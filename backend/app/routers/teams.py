from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Team, User, ShiftType
from app.schemas import TeamCreate, Team as TeamSchema, InviteCreate, ShiftTypeCreate, ShiftType as ShiftTypeSchema
from app.auth import get_current_user, get_current_manager, get_current_admin
from app.services.email import send_member_welcome_email, send_manager_welcome_email
import secrets
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/", response_model=TeamSchema)
def create_team(team: TeamCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    new_team = Team(**team.model_dump())
    db.add(new_team)
    db.commit()
    db.refresh(new_team)
    return new_team

@router.get("/", response_model=list[TeamSchema])
def get_all_teams(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return db.query(Team).all()

@router.post("/{team_id}/add-manager")
def add_manager(team_id: int, invite: InviteCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    user = db.query(User).filter(User.email == invite.email).first()
    if not user:
        user = User(email=invite.email, is_manager=True, is_admin=False, team_id=team.id)
        db.add(user)
    else:
        user.is_manager = True
        user.team_id = team.id
        
    db.commit()
    send_manager_welcome_email(invite.email, team.name, team.logo, request=request)
    return {"message": "Manager added"}

@router.get("/{team_id}/managers")
def get_team_managers(team_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return db.query(User).filter(User.team_id == team_id, User.is_manager == True).all()

@router.delete("/{team_id}/managers/{user_id}")
def remove_manager(team_id: int, user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id, User.team_id == team_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Manager not found")
    user.is_manager = False
    user.team_id = None
    db.commit()
    return {"message": "Manager removed"}

@router.get("/my-team", response_model=TeamSchema)
def get_my_team(db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    if manager.team_id:
        team = db.query(Team).filter(Team.id == manager.team_id).first()
        if team: return team
    raise HTTPException(status_code=404, detail="Team not found")

@router.put("/my-team", response_model=TeamSchema)
def update_my_team(team_in: TeamCreate, db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    if not manager.team_id:
        raise HTTPException(status_code=404, detail="Team not found")
    team = db.query(Team).filter(Team.id == manager.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team.name = team_in.name
    if team_in.logo:
        team.logo = team_in.logo
    if team_in.address is not None:
        team.address = team_in.address
    db.commit()
    db.refresh(team)
    return team

@router.delete("/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Cascade delete events related to the team's users
    users_in_team = db.query(User).filter(User.team_id == team_id).all()
    user_ids = [u.id for u in users_in_team]
    if user_ids:
        from app.models import Event, Invitation
        db.query(Event).filter(Event.user_id.in_(user_ids)).delete(synchronize_session=False)

    # Delete shift types
    db.query(ShiftType).filter(ShiftType.team_id == team_id).delete(synchronize_session=False)
    
    # Delete invitations
    from app.models import Invitation
    db.query(Invitation).filter(Invitation.team_id == team_id).delete(synchronize_session=False)

    # Delete members (or just decouple admins)
    for u in users_in_team:
        if u.is_admin:
            u.team_id = None
            u.is_manager = False
        else:
            db.delete(u)

    db.delete(team)
    db.commit()
    return {"message": "Team and all related data deleted"}

@router.post("/add-member")
def add_member(invite: InviteCreate, request: Request, db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    team = db.query(Team).filter(Team.id == manager.team_id).first()
    if not team:
        raise HTTPException(status_code=400, detail="You do not manage a team")
    
    user = db.query(User).filter(User.email == invite.email).first()
    if not user:
        user = User(email=invite.email, is_manager=False, is_admin=False, team_id=team.id)
        db.add(user)
    else:
        user.team_id = team.id
        
    db.commit()
    send_member_welcome_email(invite.email, team.name, team.logo, request=request)
    return {"message": "Membre ajouté"}

@router.get("/members")
def get_team_members(db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    team = db.query(Team).filter(Team.id == manager.team_id).first()
    if not team:
        raise HTTPException(status_code=400, detail="You do not manage a team")
    return team.members

@router.post("/shift-types", response_model=ShiftTypeSchema)
def create_shift_type(st: ShiftTypeCreate, db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    team = db.query(Team).filter(Team.id == manager.team_id).first()
    if not team:
        raise HTTPException(status_code=400, detail="You do not manage a team")
    
    new_st = ShiftType(**st.model_dump(), team_id=team.id)
    db.add(new_st)
    db.commit()
    db.refresh(new_st)
    return new_st

@router.delete("/{team_id}/members/{user_id}")
def remove_member(team_id: int, user_id: int, db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    if manager.team_id != team_id:
        raise HTTPException(status_code=403, detail="Not manager of this team")
    user = db.query(User).filter(User.id == user_id, User.team_id == team_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Cascade delete their events
    from app.models import Event
    db.query(Event).filter(Event.user_id == user.id).delete()
    
    user.team_id = None
    user.is_manager = False
    db.commit()
    return {"message": "Member removed"}

@router.get("/shift-types", response_model=list[ShiftTypeSchema])
def get_shift_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.team_id:
        return []
    return db.query(ShiftType).filter(ShiftType.team_id == current_user.team_id).all()
