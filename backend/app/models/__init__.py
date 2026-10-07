from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    profile_picture = Column(String, nullable=True)
    is_manager = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)

    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    events = relationship("Event", back_populates="user")

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    logo = Column(String, nullable=True)
    address = Column(String, nullable=True)

    members = relationship("User", back_populates="team", foreign_keys=[User.team_id])
    shift_types = relationship("ShiftType", back_populates="team")
    invitations = relationship("Invitation", back_populates="team")

class ShiftType(Base):
    __tablename__ = "shift_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    color = Column(String, default="#3788d8")
    team_id = Column(Integer, ForeignKey("teams.id"))

    team = relationship("Team", back_populates="shift_types")
    events = relationship("Event", back_populates="shift_type")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    shift_type_id = Column(Integer, ForeignKey("shift_types.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    shift_type = relationship("ShiftType", back_populates="events")
    user = relationship("User", back_populates="events")

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    email = Column(String, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    expires_at = Column(DateTime)
    used = Column(Boolean, default=False)

    team = relationship("Team", back_populates="invitations")
