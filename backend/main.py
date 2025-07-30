from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import os
import uuid
import aiofiles
from pathlib import Path

from database import get_db, engine
from models import Base, User, Pitch
from schemas import UserCreate, UserLogin, UserResponse, PitchCreate, PitchResponse
from auth import create_access_token, verify_token, get_password_hash, verify_password
from file_storage import storage
from speech_to_text import transcribe_audio

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pitch Recording API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Create uploads directory
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

@app.get("/")
async def root():
    return {"message": "Pitch Recording API"}

@app.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        username=db_user.username,
        created_at=db_user.created_at
    )

@app.post("/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    # Authenticate user
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": db_user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            id=db_user.id,
            email=db_user.email,
            username=db_user.username,
            created_at=db_user.created_at
        )
    }

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    email = verify_token(token)
    if email is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )
    
    return user

@app.post("/pitches", response_model=PitchResponse)
async def create_pitch(
    title: str = Form(...),
    description: str = Form(""),
    audio_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Read audio file content
    audio_content = await audio_file.read()
    
    # Save audio file using storage system
    try:
        file_path = await storage.save_audio_file(audio_content, audio_file.filename or "recording.wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save audio file: {str(e)}")
    
    # Transcribe audio
    try:
        transcript = await transcribe_audio(file_path)
    except Exception as e:
        transcript = f"Transcription failed: {str(e)}"
    
    # Create pitch record
    db_pitch = Pitch(
        title=title,
        description=description,
        audio_file_path=file_path,
        transcript=transcript,
        user_id=current_user.id
    )
    db.add(db_pitch)
    db.commit()
    db.refresh(db_pitch)
    
    return PitchResponse(
        id=db_pitch.id,
        title=db_pitch.title,
        description=db_pitch.description,
        transcript=db_pitch.transcript,
        created_at=db_pitch.created_at,
        user_id=db_pitch.user_id
    )

@app.get("/pitches", response_model=list[PitchResponse])
async def get_pitches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pitches = db.query(Pitch).filter(Pitch.user_id == current_user.id).all()
    return [
        PitchResponse(
            id=pitch.id,
            title=pitch.title,
            description=pitch.description,
            transcript=pitch.transcript,
            created_at=pitch.created_at,
            user_id=pitch.user_id
        )
        for pitch in pitches
    ]

@app.get("/pitches/{pitch_id}", response_model=PitchResponse)
async def get_pitch(
    pitch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pitch = db.query(Pitch).filter(
        Pitch.id == pitch_id,
        Pitch.user_id == current_user.id
    ).first()
    
    if not pitch:
        raise HTTPException(
            status_code=404,
            detail="Pitch not found"
        )
    
    return PitchResponse(
        id=pitch.id,
        title=pitch.title,
        description=pitch.description,
        transcript=pitch.transcript,
        created_at=pitch.created_at,
        user_id=pitch.user_id
    )

@app.get("/audio/{pitch_id}")
async def get_audio(
    pitch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pitch = db.query(Pitch).filter(
        Pitch.id == pitch_id,
        Pitch.user_id == current_user.id
    ).first()
    
    if not pitch:
        raise HTTPException(
            status_code=404,
            detail="Pitch not found"
        )
    
    if not Path(pitch.audio_file_path).exists():
        raise HTTPException(
            status_code=404,
            detail="Audio file not found"
        )
    
    return FileResponse(
        pitch.audio_file_path,
        media_type="audio/wav",
        filename=f"pitch_{pitch_id}.wav"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
