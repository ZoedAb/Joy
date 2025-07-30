# Pitch Recording Application

A full-stack web application that allows users to record audio pitches and automatically transcribe them using Google Gemini AI. Built with FastAPI (Python) backend and React (TypeScript) frontend.

## Features

### Phase 1: Core Foundation ✅ COMPLETED
- **User Management**: Registration, login, and authentication using JWT tokens ✅
- **Audio Recording**: Browser-based audio capture using MediaRecorder API ✅
- **Speech-to-Text**: Integration with Google Gemini AI for automatic transcription ✅
- **Pitch Storage**: Save recordings and transcripts to database and file storage ✅
- **User Dashboard**: View and manage recorded pitches with audio playback ✅

### What's Working Now:
- 🎤 **Audio Recording**: Record pitches directly in your browser
- 👤 **User Authentication**: Secure registration and login system
- 📝 **Speech Transcription**: Automatic conversion of speech to text
- 💾 **Data Persistence**: All pitches saved to database with file storage
- 🎵 **Audio Playback**: Listen to your recorded pitches
- 📱 **Responsive Design**: Works on desktop and mobile devices

### Upcoming Features:
- [ ] AI-powered pitch analysis and scoring
- [ ] Pitch sharing and collaboration
- [ ] Advanced audio processing and noise reduction
- [ ] Integration with presentation tools
- [ ] Team workspace features

## Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **SQLAlchemy**: SQL toolkit and ORM for database operations
- **SQLite**: Database for development (easily upgradeable to PostgreSQL)
- **Google Gemini AI**: Speech-to-text transcription
- **JWT**: Secure authentication tokens
- **Python 3.8+**: Required Python version

### Frontend
- **React 18**: JavaScript library for building user interfaces
- **TypeScript**: Typed superset of JavaScript
- **React Router**: Declarative routing for React
- **Axios**: HTTP client for API communication
- **Context API**: State management for authentication

## Project Structure

```
Joy/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── models.py            # Database models
│   ├── schemas.py           # Pydantic schemas for API
│   ├── database.py          # Database configuration
│   ├── auth.py              # Authentication utilities
│   ├── speech_to_text.py    # Gemini AI integration
│   ├── requirements.txt     # Python dependencies
│   ├── .env                 # Environment variables
│   └── uploads/             # Audio file storage
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── App.tsx          # Main App component
│   │   └── index.tsx        # Entry point
│   ├── public/              # Static files
│   └── package.json         # Node.js dependencies
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
- `POST /pitches` - Create a new pitch with audio file
- `GET /pitches` - Get all pitches for authenticated user
- `GET /pitches/{pitch_id}` - Get specific pitch

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

## Development Notes

### Getting Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create a new project or select existing one
3. Generate an API key
4. Add it to your backend `.env` file

### Audio Recording
- Uses browser's MediaRecorder API
- Supports modern browsers (Chrome, Firefox, Safari)
- Requires HTTPS in production for microphone access

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
5. Use cloud storage for audio files

### Frontend
1. Build the production bundle: `npm run build`
2. Serve static files with nginx or similar
3. Update API_BASE_URL for your backend

## Troubleshooting

### Common Issues

1. **Microphone not working**: Ensure HTTPS in production and grant microphone permissions
2. **CORS errors**: Check that backend CORS is configured for your frontend URL
3. **Authentication issues**: Verify JWT secret key consistency
4. **Transcription not working**: Check Gemini API key and quota

### Error Codes
- `400`: Bad Request - Check request format
- `401`: Unauthorized - Check authentication token
- `404`: Not Found - Resource doesn't exist
- `422`: Validation Error - Check request data format

## Future Enhancements

- [ ] Pitch analysis and feedback
- [ ] Team collaboration features
- [ ] Advanced audio processing
- [ ] Mobile app development
- [ ] Integration with presentation tools
- [ ] AI-powered pitch scoring

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
