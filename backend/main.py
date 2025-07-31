from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import os
import uuid
import aiofiles
import json
import asyncio
from pathlib import Path

from database import get_db, engine
from models import Base, User, Pitch
from schemas import UserCreate, UserLogin, UserResponse, PitchCreate, PitchResponse
from auth import create_access_token, verify_token, get_password_hash, verify_password
from file_storage import storage
from speech_to_text import transcribe_audio
from voice_analysis import ml_voice_analyzer
from investor_ai import investor_ai
from realtime_analysis import realtime_analyzer

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

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_sessions: Dict[str, str] = {}  # user_id -> session_id
    
    async def connect(self, websocket: WebSocket, session_id: str, user_id: str):
        # Don't call accept() here - it should be called in the main endpoint
        self.active_connections[session_id] = websocket
        self.user_sessions[user_id] = session_id
        print(f"WebSocket connected: session {session_id}, user {user_id}")
    
    def disconnect(self, session_id: str, user_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if user_id in self.user_sessions:
            del self.user_sessions[user_id]
        print(f"WebSocket disconnected: session {session_id}")
    
    async def send_personal_message(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                # Check if WebSocket is still open
                if websocket.client_state.name != 'CONNECTED':
                    print(f"WebSocket {session_id} not connected, removing from active connections")
                    self.disconnect(session_id, "unknown")
                    return
                
                # Ensure all data is JSON serializable
                safe_message = self._make_json_safe(message)
                await websocket.send_text(json.dumps(safe_message))
            except Exception as e:
                print(f"Error sending message to {session_id}: {e}")
                # Remove broken connection
                self.disconnect(session_id, "unknown")
    
    def _make_json_safe(self, obj):
        """Convert objects to JSON-safe format"""
        if isinstance(obj, dict):
            return {k: self._make_json_safe(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_json_safe(item) for item in obj]
        elif isinstance(obj, (bool, int, float, str, type(None))):
            return obj
        elif hasattr(obj, '__dict__'):
            return {k: self._make_json_safe(v) for k, v in obj.__dict__.items()}
        else:
            return str(obj)  # Convert everything else to string
    
    async def emit_to_session(self, event: str, data: dict, session_id: str = None):
        """Emit event to specific session or all sessions"""
        message = {
            'event': event,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        
        if session_id:
            await self.send_personal_message(message, session_id)
        else:
            # Broadcast to all connections
            for session_id, websocket in self.active_connections.items():
                await self.send_personal_message(message, session_id)

manager = ConnectionManager()

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
    
    # Perform ML voice analysis
    analysis_result = None
    if transcript and not transcript.startswith("Transcription failed"):
        try:
            # Calculate audio duration (approximate)
            import librosa
            y, sr = librosa.load(file_path)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # Perform ML analysis
            analysis = await ml_voice_analyzer.analyze_transcript(
                transcript=transcript,
                audio_duration=duration,
                audio_file_path=file_path
            )
            
            # Convert analysis to JSON string
            import json
            analysis_result = json.dumps(analysis, default=str)
            
        except Exception as e:
            print(f"Analysis failed: {e}")  # Log for debugging
            analysis_result = json.dumps({
                'error': f'Analysis failed: {str(e)}',
                'confidence_score': 0,
                'overall_grade': 'F'
            })
    
    # Create pitch record
    db_pitch = Pitch(
        title=title,
        description=description,
        audio_file_path=file_path,
        transcript=transcript,
        analysis_result=analysis_result,
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
        analysis_result=db_pitch.analysis_result,
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
            analysis_result=pitch.analysis_result,
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
        analysis_result=pitch.analysis_result,
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

@app.post("/pitches/{pitch_id}/investor-response")
async def generate_investor_response(
    pitch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI investor response for a specific pitch"""
    # Get the pitch
    pitch = db.query(Pitch).filter(
        Pitch.id == pitch_id,
        Pitch.user_id == current_user.id
    ).first()
    
    if not pitch:
        raise HTTPException(
            status_code=404,
            detail="Pitch not found"
        )
    
    # Generate investor response
    try:
        response = await investor_ai.generate_investor_response(
            transcript=pitch.transcript,
            analysis_result=pitch.analysis_result
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate investor response: {str(e)}"
        )

@app.get("/pitches/{pitch_id}/analysis")
async def get_pitch_analysis(
    pitch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed analysis results for a specific pitch"""
    pitch = db.query(Pitch).filter(
        Pitch.id == pitch_id,
        Pitch.user_id == current_user.id
    ).first()
    
    if not pitch:
        raise HTTPException(
            status_code=404,
            detail="Pitch not found"
        )
    
    if not pitch.analysis_result:
        raise HTTPException(
            status_code=404,
            detail="Analysis not available for this pitch"
        )
    
    try:
        import json
        analysis = json.loads(pitch.analysis_result)
        return analysis
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Invalid analysis data"
        )

@app.websocket("/ws/realtime/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time pitch analysis"""
    user = None
    try:
        # Accept connection first
        await websocket.accept()
        print(f"WebSocket connection accepted for session: {session_id}")
        
        # Wait for authentication message
        try:
            auth_data = await websocket.receive_text()
            auth_message = json.loads(auth_data)
        except Exception as e:
            print(f"Failed to receive auth data: {e}")
            await websocket.send_text(json.dumps({'error': 'Failed to receive authentication data'}))
            await websocket.close()
            return
        
        # Verify token
        token = auth_message.get('token')
        if not token:
            await websocket.send_text(json.dumps({'error': 'Authentication token required'}))
            await websocket.close()
            return
        
        # Get user from token
        try:
            email = verify_token(token)
            if not email:
                await websocket.send_text(json.dumps({'error': 'Invalid token'}))
                await websocket.close()
                return
            
            # Get user from database
            db = next(get_db())
            user = db.query(User).filter(User.email == email).first()
            if not user:
                await websocket.send_text(json.dumps({'error': 'User not found'}))
                await websocket.close()
                return
            
            print(f"User authenticated: {user.email} for session {session_id}")
            
        except Exception as e:
            print(f"Authentication error: {e}")
            await websocket.send_text(json.dumps({'error': f'Authentication failed: {str(e)}'}))
            await websocket.close()
            return
        
        # Register connection (no accept call here)
        await manager.connect(websocket, session_id, str(user.id))
        
        # Start real-time analysis session
        try:
            await realtime_analyzer.start_session(session_id, user.id)
            print(f"Real-time session started for {session_id}")
        except Exception as e:
            print(f"Failed to start real-time session: {e}")
            await websocket.send_text(json.dumps({'error': f'Failed to start session: {str(e)}'}))
            await websocket.close()
            return
        
        # Create emit callback for real-time updates
        async def emit_callback(event: str, data: dict):
            try:
                await manager.emit_to_session(event, data, session_id)
            except Exception as e:
                print(f"Error emitting event {event}: {e}")
        
        # Send connection confirmation
        await manager.emit_to_session('connected', {
            'session_id': session_id,
            'user_id': user.id,
            'status': 'ready_for_audio'
        }, session_id)
        
        print(f"WebSocket fully connected and ready for session {session_id}")
        
        try:
            while True:
                # Receive message from client
                try:
                    message = await websocket.receive()
                except WebSocketDisconnect:
                    print(f"Client disconnected from session {session_id}")
                    break
                except Exception as e:
                    print(f"Error receiving message: {e}")
                    break
                
                if message['type'] == 'websocket.receive':
                    if 'bytes' in message:
                        # Process audio data
                        audio_data = message['bytes']
                        
                        # Process audio chunk with real-time analysis
                        result = await realtime_analyzer.process_audio_chunk(
                            session_id=session_id,
                            audio_data=audio_data,
                            emit_callback=emit_callback
                        )
                        
                    elif 'text' in message:
                        # Handle text commands
                        try:
                            command = json.loads(message['text'])
                            command_type = command.get('type')
                            
                            if command_type == 'request_investor_response':
                                # Generate live investor response
                                response = await realtime_analyzer.generate_live_investor_response(
                                    session_id=session_id,
                                    emit_callback=emit_callback
                                )
                                
                            elif command_type == 'end_session':
                                # End the session
                                summary = await realtime_analyzer.end_session(session_id)
                                await manager.emit_to_session('session_ended', summary, session_id)
                                break
                                
                            elif command_type == 'get_metrics':
                                # Send current metrics
                                await manager.emit_to_session('current_metrics', {
                                    'metrics': realtime_analyzer.live_metrics
                                }, session_id)
                                
                        except json.JSONDecodeError:
                            await manager.emit_to_session('error', {
                                'message': 'Invalid command format'
                            }, session_id)
                
        except WebSocketDisconnect:
            # Handle client disconnect
            print(f"Client disconnected from session {session_id}")
            
        except Exception as e:
            print(f"WebSocket error in session {session_id}: {e}")
            await manager.emit_to_session('error', {
                'message': f'Server error: {str(e)}'
            }, session_id)
            
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        
    finally:
        # Clean up
        manager.disconnect(session_id, str(user.id) if 'user' in locals() else 'unknown')
        try:
            await realtime_analyzer.end_session(session_id)
        except:
            pass

@app.post("/realtime/start-session")
async def start_realtime_session(
    current_user: User = Depends(get_current_user)
):
    """Start a new real-time analysis session"""
    session_id = str(uuid.uuid4())
    
    try:
        result = await realtime_analyzer.start_session(session_id, current_user.id)
        return {
            'session_id': session_id,
            'websocket_url': f'/ws/realtime/{session_id}',
            'status': 'ready',
            'user_id': current_user.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start session: {str(e)}"
        )

@app.get("/realtime/session/{session_id}/metrics")
async def get_session_metrics(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get current metrics for a real-time session"""
    try:
        if session_id in realtime_analyzer.session_data:
            session = realtime_analyzer.session_data[session_id]
            if session['user_id'] != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied")
            
            return {
                'session_id': session_id,
                'live_metrics': realtime_analyzer.live_metrics,
                'session_info': {
                    'start_time': session['start_time'].isoformat(),
                    'total_chunks': session['total_chunks'],
                    'analysis_count': len(session['analysis_results'])
                }
            }
        else:
            raise HTTPException(status_code=404, detail="Session not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get metrics: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
