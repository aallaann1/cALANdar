from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture: Optional[str] = None

class UserCreate(UserBase):
    token: Optional[str] = None # For invitations

class GoogleToken(BaseModel):
    token: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None

class User(UserBase):
    id: int
    is_manager: bool
    is_admin: bool
    team_id: Optional[int] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class TeamBase(BaseModel):
    name: str
    logo: Optional[str] = None
    address: Optional[str] = None

class TeamCreate(TeamBase):
    pass

class Team(TeamBase):
    id: int

    class Config:
        from_attributes = True

class ShiftTypeBase(BaseModel):
    name: str
    color: str

class ShiftTypeCreate(ShiftTypeBase):
    pass

class ShiftType(ShiftTypeBase):
    id: int
    team_id: int

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    start_time: datetime
    end_time: datetime
    shift_type_id: int

class EventCreate(EventBase):
    user_ids: list[int]

class Event(EventBase):
    id: int
    user_id: int
    shift_type: ShiftType
    user: User

    class Config:
        from_attributes = True

class InviteCreate(BaseModel):
    email: EmailStr
