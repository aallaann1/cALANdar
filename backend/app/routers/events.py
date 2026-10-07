from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Event, User, ShiftType
from app.schemas import EventCreate, Event as EventSchema
from app.auth import get_current_user, get_current_manager

router = APIRouter()

@router.post("/", response_model=list[EventSchema])
def create_event(event_in: EventCreate, db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    created_events = []
    for uid in event_in.user_ids:
        # Verify user belongs to manager's team
        target_user = db.query(User).filter(User.id == uid).first()
        if not target_user or target_user.team_id != manager.team_id:
            raise HTTPException(status_code=400, detail=f"User {uid} is not in your team")
        
        new_event = Event(
            user_id=uid,
            shift_type_id=event_in.shift_type_id,
            start_time=event_in.start_time,
            end_time=event_in.end_time
        )
        db.add(new_event)
        created_events.append(new_event)
        
    db.commit()
    for ev in created_events:
        db.refresh(ev)
    return created_events

@router.get("/", response_model=list[EventSchema])
def get_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_manager and current_user.team_id:
        return db.query(Event).join(User).filter(User.team_id == current_user.team_id).all()
    else:
        # Get only user's events
        return db.query(Event).filter(Event.user_id == current_user.id).all()

from fastapi import Query

@router.delete("/")
def delete_events(ids: str = Query(...), db: Session = Depends(get_db), manager: User = Depends(get_current_manager)):
    if not manager.team_id:
        raise HTTPException(status_code=403, detail="Not a team manager")
        
    id_list = [int(i) for i in ids.split(",") if i.isdigit()]
    if not id_list:
        return {"message": "No valid ids"}
        
    # Verify these events belong to users in the manager's team
    events = db.query(Event).join(User).filter(Event.id.in_(id_list), User.team_id == manager.team_id).all()
    
    for ev in events:
        db.delete(ev)
    db.commit()
    return {"message": "Events deleted"}
