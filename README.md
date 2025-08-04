# Pitch Recording Application

A full-stack web application that allows users to record audio pitches and automatically transcribe them using Google Gemini AI. Built with FastAPI (Python) backend and React (TypeScript) frontend.

## Features

### Phase 1: Core Foundation ✅ COMPLETED
- **User Management**: Registration, login, and authentication using JWT tokens ✅
- **Audio Recording**: Browser-based audio capture using MediaRecorder API ✅
- **Speech-to-Text**: Integration with Google Gemini AI for automatic transcription ✅
- **Pitch Storage**: Save recordings and transcripts to database and file storage ✅
- **User Dashboard**: View and manage recorded pitches with audio playback ✅

### Phase 2: Advanced Analysis & Reporting ✅ COMPLETED
- **Multimodal Analysis**: Combined audio and video emotion analysis ✅
- **Enhanced Voice Analysis**: Advanced voice emotion recognition and business appropriateness scoring ✅
- **Video Emotion Analysis**: Real-time facial expression analysis and emotion detection ✅
- **Comprehensive Reporting**: Detailed pitch analysis with visualizations and actionable insights ✅
- **Smart Grading System**: Realistic scoring with penalties for poor performance ✅
- **Performance Dashboard**: Interactive charts and metrics visualization ✅

### What's Working Now:
- 🎤 **Audio Recording**: Record pitches directly in your browser
- 👤 **User Authentication**: Secure registration and login system
- 📝 **Speech Transcription**: Automatic conversion of speech to text
- 💾 **Data Persistence**: All pitches saved to database with file storage
- 🎵 **Audio Playback**: Listen to your recorded pitches
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🧠 **AI-Powered Analysis**: Comprehensive voice and video emotion analysis
- 📊 **Smart Grading**: Realistic scoring system that properly penalizes poor performance
- 📈 **Performance Visualizations**: Interactive charts and metrics dashboard
- 🎯 **Actionable Feedback**: Specific recommendations for improvement
- 📋 **Comprehensive Reports**: Detailed analysis with strengths, weaknesses, and next steps

### Key Improvements:
- **Fixed Grading Logic**: No more "A" grades for silent/fearful presentations
- **Realistic Scoring**: Proper penalties for low confidence and poor emotional expression
- **Enhanced Weakness Detection**: Identifies critical issues like fear, sadness, or anger
- **Stricter Thresholds**: A grade now requires ≥90, F grade for scores <45
- **Multi-Area Assessment**: Detects when multiple areas need significant improvement

### Upcoming Features:
- [ ] Pitch sharing and collaboration
- [ ] Advanced audio processing and noise reduction
- [ ] Integration with presentation tools
- [ ] Team workspace features
- [ ] Real-time coaching feedback

## Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **SQLAlchemy**: SQL toolkit and ORM for database operations
- **SQLite**: Database for development (easily upgradeable to PostgreSQL)
- **Google Gemini AI**: Speech-to-text transcription
- **JWT**: Secure authentication tokens
- **Python 3.8+**: Required Python version
- **Plotly**: Interactive data visualization
- **Matplotlib/Seaborn**: Statistical data visualization
- **NumPy/Pandas**: Data processing and analysis

### Frontend
- **React 18**: JavaScript library for building user interfaces
- **TypeScript**: Typed superset of JavaScript
- **React Router**: Declarative routing for React
- **Axios**: HTTP client for API communication
- **Context API**: State management for authentication
- **CSS3**: Modern styling with responsive design

## Project Structure

```
Joy/
├── backend/
│   ├── main.py                    # FastAPI application entry point
│   ├── models.py                  # Database models
│   ├── schemas.py                 # Pydantic schemas for API
│   ├── database.py                # Database configuration
│   ├── auth.py                    # Authentication utilities
│   ├── speech_to_text.py          # Gemini AI integration
│   ├── comprehensive_reporting.py # Advanced reporting system
│   ├── enhanced_voice_emotion.py  # Voice emotion analysis
│   ├── video_emotion_analysis.py  # Video emotion detection
│   ├── realtime_analysis.py       # Real-time analysis
│   ├── requirements.txt           # Python dependencies
│   ├── .env                       # Environment variables
│   └── uploads/                   # Audio/video file storage
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── ComprehensiveReport/ # Advanced reporting UI
│   │   │   ├── VideoRecorder/     # Video recording component
│   │   │   └── ...                # Other components
│   │   ├── contexts/              # React contexts
│   │   ├── App.tsx                # Main App component
│   │   └── index.tsx              # Entry point
│   ├── public/                    # Static files
│   └── package.json               # Node.js dependencies
└── README.md
```

## Quick Start

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows
   venv\\Scripts\\activate
   # macOS/Linux
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   # Copy the example file and edit with your values
   cp .env.example .env
   ```
   
   Edit `.env` and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   SECRET_KEY=your-secret-key-here
   ```

5. Run the development server:
   ```bash
   python main.py
   ```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login

### Pitches
- `POST /pitches` - Create a new pitch with audio/video file
- `GET /pitches` - Get all pitches for authenticated user
- `GET /pitches/{pitch_id}` - Get specific pitch
- `GET /pitches/{pitch_id}/analysis` - Get pitch analysis results

### Advanced Analysis
- `POST /audio/enhanced-emotion-analysis` - Enhanced voice emotion analysis
- `POST /video/emotion-analysis` - Video emotion analysis
- `POST /video/comprehensive-analysis` - Comprehensive video analysis
- `POST /multimodal/analyze` - Combined audio and video analysis
- `POST /pitches/{pitch_id}/comprehensive-report` - Generate detailed reports

### Real-time Features
- `POST /realtime/start-session` - Start real-time analysis session
- `GET /realtime/session/{session_id}/metrics` - Get real-time metrics
- `WebSocket /ws/realtime/{session_id}` - Real-time data streaming

## Environment Variables

### Backend (.env)
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite:///./pitches.db
SECRET_KEY=your-secret-key-here-change-in-production
```

### Frontend (.env)
```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

## Analysis Features

### Voice Analysis
- **Confidence Scoring**: Measures speaker confidence and assertiveness
- **Emotion Detection**: Identifies emotional tone (happy, sad, angry, etc.)
- **Speaking Pace**: Analyzes words per minute and pacing
- **Voice Quality**: Measures pitch stability, amplitude, and fluency
- **Business Appropriateness**: Evaluates professional presentation skills

### Video Analysis
- **Facial Expression Analysis**: Detects emotions from facial expressions
- **Emotion Stability**: Measures consistency of emotional presentation
- **Business Readiness**: Evaluates professional visual presentation
- **Real-time Processing**: Live emotion detection during recording

### Comprehensive Reporting
- **Performance Dashboard**: Interactive gauges and metrics
- **Emotion Radar Charts**: Multimodal emotion analysis visualization
- **Improvement Areas**: Priority-based improvement recommendations
- **Benchmarking**: Comparison with industry standards
- **Actionable Insights**: Specific, personalized recommendations

### Smart Grading System
- **Realistic Scoring**: Proper penalties for poor performance
- **Stricter Thresholds**: A requires ≥90, F for <45
- **Critical Issue Detection**: Flags fear, sadness, or anger
- **Multi-Area Assessment**: Identifies comprehensive improvement needs

## Development Notes

### Getting Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create a new project or select existing one
3. Generate an API key
4. Add it to your backend `.env` file

### Audio/Video Recording
- Uses browser's MediaRecorder API
- Supports modern browsers (Chrome, Firefox, Safari)
- Requires HTTPS in production for microphone/camera access
- Supports both audio-only and video recording

### Database
- SQLite for development
- Automatic table creation on startup
- Easy migration to PostgreSQL for production

## Production Deployment

### Backend
1. Use a production WSGI server like Gunicorn
2. Set up environment variables securely
3. Use PostgreSQL instead of SQLite
4. Configure CORS for your domain
5. Use cloud storage for audio/video files

### Frontend
1. Build the production bundle: `npm run build`
2. Serve static files with nginx or similar
3. Update API_BASE_URL for your backend

## Troubleshooting

### Common Issues

1. **Microphone/Camera not working**: Ensure HTTPS in production and grant permissions
2. **CORS errors**: Check that backend CORS is configured for your frontend URL
3. **Authentication issues**: Verify JWT secret key consistency
4. **Transcription not working**: Check Gemini API key and quota
5. **Analysis errors**: Ensure all required dependencies are installed

### Error Codes
- `400`: Bad Request - Check request format
- `401`: Unauthorized - Check authentication token
- `404`: Not Found - Resource doesn't exist
- `422`: Validation Error - Check request data format
- `500`: Internal Server Error - Check server logs

## Future Enhancements

- [ ] Pitch sharing and collaboration features
- [ ] Advanced audio processing and noise reduction
- [ ] Integration with presentation tools
- [ ] Mobile app development
- [ ] Team workspace features
- [ ] Real-time coaching feedback
- [ ] Advanced AI-powered pitch scoring
- [ ] Integration with CRM systems

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation at `http://localhost:8000/docs` when backend is running

## Recent Updates

### Grading System Fixes (Latest)
- ✅ **Fixed unrealistic scoring**: No more "A" grades for silent/fearful presentations
- ✅ **Implemented proper penalties**: 30% penalty for very low confidence, 20% for poor emotions
- ✅ **Stricter grade thresholds**: A requires ≥90, F for <45
- ✅ **Enhanced weakness detection**: Identifies critical issues and multi-area problems
- ✅ **Realistic feedback**: Provides actionable, specific improvement recommendations
