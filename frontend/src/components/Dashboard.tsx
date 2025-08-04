import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import AudioRecorder from './AudioRecorder';
import PitchList from './PitchList';
import RealTimePitch from './RealTimePitch/RealTimePitch';
import VideoRecorder from './VideoRecorder/VideoRecorder';
import ComprehensiveReport from './ComprehensiveReport/ComprehensiveReport';
import './Dashboard.css';

interface Pitch {
  id: number;
  title: string;
  description: string;
  transcript: string;
  created_at: string;
  user_id: number;
}

type TabType = 'record' | 'realtime' | 'video' | 'pitches';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [selectedPitchId, setSelectedPitchId] = useState<number | null>(null);
  const [showComprehensiveReport, setShowComprehensiveReport] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);

  const handleNewPitch = (newPitch: Pitch) => {
    setPitches(prev => [newPitch, ...prev]);
  };



  const handleCloseReport = () => {
    setShowComprehensiveReport(false);
    setSelectedPitchId(null);
  };

  const handleVideoRecorded = async (videoBlob: Blob) => {
    try {
      // Show loading message
      alert('Uploading video pitch... This may take up to 60 seconds for processing.');
      
      const formData = new FormData();
      formData.append('title', `Video Pitch - ${new Date().toLocaleDateString()}`);
      formData.append('description', 'Video pitch with emotion analysis');
      
      // For video uploads, we don't need to send audio file
      // The backend will handle video-only uploads
      
      // Add the video file
      formData.append('video_file', videoBlob, `video_pitch_${Date.now()}.webm`);

      const response = await api.post('/pitches', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000 // 2 minutes timeout for video uploads
      });

      if (response.data) {
        // Update pitches list
        const newPitch = response.data;
        setPitches(prev => [newPitch, ...prev]);
        
        // Show success message
        alert('Video pitch uploaded and processed successfully! Analysis is ready.');
        
        // Optional: Switch to pitches tab to see the new pitch
        setActiveTab('pitches');
      }
    } catch (error: any) {
      console.error('Error uploading video pitch:', error);
      
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED') {
        alert('Upload timed out. The video processing is taking longer than expected. Please try again or check your internet connection.');
      } else if (error.response?.status === 413) {
        alert('Video file is too large. Please try recording a shorter video.');
      } else if (error.response?.status === 400) {
        alert('Invalid video format. Please ensure your browser supports video recording.');
      } else {
        alert(`Failed to upload video pitch: ${error.response?.data?.detail || error.message || 'Unknown error'}. Please try again.`);
      }
    }
  };

  const handleStartVideoRecording = () => {
    setIsVideoRecording(true);
  };

  const handleStopVideoRecording = () => {
    setIsVideoRecording(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'record':
        return (
          <section className="recording-section">
            <h3>📼 Record a New Pitch</h3>
            <AudioRecorder onNewPitch={handleNewPitch} />
          </section>
        );
      case 'realtime':
        return (
          <section className="realtime-section">
            <RealTimePitch />
          </section>
        );
      case 'video':
        return (
          <section className="video-section">
            <h3>🎥 Video Pitch Analysis</h3>
            <p className="section-description">
              Record with video for enhanced emotion analysis and comprehensive feedback
            </p>
            <VideoRecorder
              onVideoRecorded={handleVideoRecorded}
              isRecording={isVideoRecording}
              onStartRecording={handleStartVideoRecording}
              onStopRecording={handleStopVideoRecording}
              enableFaceDetection={true}
            />
          </section>
        );
      case 'pitches':
        return (
          <section className="pitches-section">
            <h3>📚 Your Pitches</h3>
            <PitchList 
              pitches={pitches} 
              setPitches={setPitches}
            />
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="user-info">
          <h2>Welcome, {user?.username}!</h2>
          <p>Email: {user?.email}</p>
        </div>
        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </div>
      
      {/* Navigation Tabs */}
      <div className="dashboard-nav">
        <button 
          className={`nav-tab ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => setActiveTab('record')}
        >
          📼 Traditional Recording
        </button>
        <button 
          className={`nav-tab ${activeTab === 'realtime' ? 'active' : ''}`}
          onClick={() => setActiveTab('realtime')}
        >
          🚀 Real-Time Analysis
        </button>
        <button 
          className={`nav-tab ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
        >
          🎥 Video Analysis
        </button>
        <button 
          className={`nav-tab ${activeTab === 'pitches' ? 'active' : ''}`}
          onClick={() => setActiveTab('pitches')}
        >
          📚 My Pitches
        </button>
      </div>
      
      <div className="dashboard-content">
        {renderTabContent()}
      </div>

      {/* Comprehensive Report Modal */}
      {showComprehensiveReport && selectedPitchId && (
        <ComprehensiveReport
          pitchId={selectedPitchId}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
};

export default Dashboard;
