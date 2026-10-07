from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Event, User, Team
from icalendar import Calendar, Event as IcalEvent
from datetime import datetime

router = APIRouter()

@router.get("/user/{user_id}.ics")
def get_user_ical(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    events = db.query(Event).filter(Event.user_id == user_id).all()
    
    cal = Calendar()
    cal.add('prodid', '-//cALANdar User Planning//mxm.dk//')
    cal.add('version', '2.0')
    
    for event in events:
        ie = IcalEvent()
        ie.add('summary', f"Shift: {event.shift_type.name}")
        ie.add('dtstart', event.start_time)
        ie.add('dtend', event.end_time)
        ie.add('dtstamp', datetime.utcnow())
        if user.team and user.team.address:
            ie.add('location', user.team.address)
        cal.add_component(ie)
        
    return Response(content=cal.to_ical(), media_type="text/calendar")

@router.get("/team/{team_id}.ics")
def get_team_ical(team_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    events = db.query(Event).join(User).filter(User.team_id == team_id).all()
    
    cal = Calendar()
    cal.add('prodid', '-//cALANdar Team Planning//mxm.dk//')
    cal.add('version', '2.0')
    
    for event in events:
        ie = IcalEvent()
        ie.add('summary', f"[{event.user.first_name} {event.user.last_name}] {event.shift_type.name}")
        ie.add('dtstart', event.start_time)
        ie.add('dtend', event.end_time)
        ie.add('dtstamp', datetime.utcnow())
        if team.address:
            ie.add('location', team.address)
        cal.add_component(ie)
        
    return Response(content=cal.to_ical(), media_type="text/calendar")
