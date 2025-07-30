<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Pitch Recording Application

This is a full-stack pitch recording application built with FastAPI (Python) backend and React (TypeScript) frontend.

## Backend (FastAPI)
- Located in `/backend` directory
- Uses SQLAlchemy for database operations with SQLite
- JWT authentication for user management
- Audio file handling and storage
- Integration with Google Gemini AI for speech-to-text transcription
- RESTful API endpoints for user registration, login, and pitch management

## Frontend (React + TypeScript)
- Located in `/frontend` directory
- Uses React Router for navigation
- Context API for state management (authentication)
- Audio recording capabilities using MediaRecorder API
- Axios for API communication
- Responsive design with CSS modules

## Key Features
- User registration and authentication
- Audio recording in the browser
- Speech-to-text transcription using Gemini AI
- Pitch storage and management
- User dashboard with pitch history

## Development Setup
- Backend runs on port 8000
- Frontend runs on port 3000
- CORS configured for development
- Environment variables for configuration

## Architecture Notes
- Follows separation of concerns with clear API boundaries
- JWT tokens for secure authentication
- File upload handling for audio files
- Async/await patterns for better performance

When working on this project, consider:
- Maintaining consistent error handling patterns
- Following RESTful API conventions
- Ensuring proper TypeScript typing
- Implementing responsive design principles
- Keeping security best practices in mind
