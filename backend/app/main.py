from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
import os
import shutil

from app.core.database import engine, Base, get_db
from app.core.config import settings
from app.models import User
from app.core.security import get_password_hash, verify_password, create_access_token

from app.routers import users, teams, events, ical

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Initialize admin user
    db = next(get_db())
    admin_email = settings.ADMIN_EMAIL
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        new_admin = User(
            email=admin_email,
            hashed_password=get_password_hash("1234"),
            is_admin=True,
            is_manager=False,
            first_name="Admin",
            last_name="System"
        )
        db.add(new_admin)
        db.commit()
    db.close()
    yield

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

os.makedirs("uploads", exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    return {"url": f"/api/uploads/{file.filename}"}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(ical.router, prefix="/api/ical", tags=["ical"])

from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests

class GoogleToken(BaseModel):
    token: str

@app.post("/api/auth/google")
def google_auth(token_in: GoogleToken, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(token_in.token, requests.Request(), settings.GOOGLE_CLIENT_ID)
        email = idinfo['email']
        first_name = idinfo.get('given_name')
        last_name = idinfo.get('family_name')
        picture = idinfo.get('picture')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google token")

    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Create a new user with no team
        user = User(
            email=email,
            is_manager=False,
            is_admin=False,
            first_name=first_name,
            last_name=last_name,
            profile_picture=picture
        )
        db.add(user)
    else:
        # Update profile from Google
        if first_name: user.first_name = first_name
        if last_name: user.last_name = last_name
        if picture: user.profile_picture = picture
        
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}
