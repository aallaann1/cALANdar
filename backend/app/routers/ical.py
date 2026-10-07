from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Event, User, Team
from icalendar import Calendar, Event as IcalEvent
from datetime import datetime
from zoneinfo import ZoneInfo

PARIS_TZ = ZoneInfo("Europe/Paris")

router = APIRouter()

@router.get("/user/{user_id}.ics")
def get_user_ical(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    events = db.query(Event).filter(Event.user_id == user_id).all()
    
    # Group events by (shift_type_id, start_time, end_time) to include coworkers on the same shift
    groups = {}
    for event in events:
        key = (event.shift_type_id, event.start_time, event.end_time)
        if key not in groups:
            # Query all team events matching this slot to find all users
            all_users_in_slot = []
            if user.team_id:
                slot_events = db.query(Event).join(User).filter(
                    User.team_id == user.team_id,
                    Event.shift_type_id == event.shift_type_id,
                    Event.start_time == event.start_time,
                    Event.end_time == event.end_time
                ).all()
                all_users_in_slot = [e.user for e in slot_events]
            else:
                all_users_in_slot = [event.user]
            groups[key] = {
                'shift_type': event.shift_type,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'users': all_users_in_slot
            }

    cal = Calendar()
    cal.add('prodid', '-//cALANdar User Planning//mxm.dk//')
    cal.add('version', '2.0')
    
    for g in groups.values():
        ie = IcalEvent()
        names = [u.first_name for u in g['users'] if u.first_name]
        if not names:
            names = ["Inconnu"]
        if len(names) > 1:
            names_str = ", ".join(names[:-1]) + " et " + names[-1]
        else:
            names_str = names[0]

        summary = f"{g['shift_type'].name} {names_str}".strip()
        ie.add('summary', summary)
        
        start_dt = g['start_time'].replace(tzinfo=PARIS_TZ) if g['start_time'].tzinfo is None else g['start_time'].astimezone(PARIS_TZ)
        end_dt = g['end_time'].replace(tzinfo=PARIS_TZ) if g['end_time'].tzinfo is None else g['end_time'].astimezone(PARIS_TZ)
        
        ie.add('dtstart', start_dt)
        ie.add('dtend', end_dt)
        ie.add('dtstamp', datetime.utcnow())
        if g['shift_type'].color:
            ie.add('color', g['shift_type'].color)
            ie.add('x-apple-calendar-color', g['shift_type'].color)
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
    
    groups = {}
    for event in events:
        key = (event.shift_type_id, event.start_time, event.end_time)
        if key not in groups:
            groups[key] = {
                'shift_type': event.shift_type,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'users': []
            }
        groups[key]['users'].append(event.user)

    cal = Calendar()
    cal.add('prodid', '-//cALANdar Team Planning//mxm.dk//')
    cal.add('version', '2.0')
    
    for g in groups.values():
        ie = IcalEvent()
        names = [u.first_name for u in g['users'] if u.first_name]
        if not names:
            names = ["Inconnu"]
        if len(names) > 1:
            names_str = ", ".join(names[:-1]) + " et " + names[-1]
        else:
            names_str = names[0]

        summary = f"{g['shift_type'].name} {names_str}".strip()
        ie.add('summary', summary)
        
        start_dt = g['start_time'].replace(tzinfo=PARIS_TZ) if g['start_time'].tzinfo is None else g['start_time'].astimezone(PARIS_TZ)
        end_dt = g['end_time'].replace(tzinfo=PARIS_TZ) if g['end_time'].tzinfo is None else g['end_time'].astimezone(PARIS_TZ)
        
        ie.add('dtstart', start_dt)
        ie.add('dtend', end_dt)
        ie.add('dtstamp', datetime.utcnow())
        if g['shift_type'].color:
            ie.add('color', g['shift_type'].color)
            ie.add('x-apple-calendar-color', g['shift_type'].color)
        if team.address:
            ie.add('location', team.address)
        cal.add_component(ie)
        
    return Response(content=cal.to_ical(), media_type="text/calendar")
