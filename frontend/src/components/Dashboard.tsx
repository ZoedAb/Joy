import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AudioRecorder from './AudioRecorder';
import PitchList from './PitchList';
import RealTimePitch from './RealTimePitch/RealTimePitch';
import './Dashboard.css';

interface Pitch {
  id: number;
  title: string;
  description: string;
  transcript: string;
  created_at: string;
  user_id: number;
}

type TabType = 'record' | 'realtime' | 'pitches';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('record');

  const handleNewPitch = (newPitch: Pitch) => {
    setPitches(prev => [newPitch, ...prev]);
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
      case 'pitches':
        return (
          <section className="pitches-section">
            <h3>📚 Your Pitches</h3>
            <PitchList pitches={pitches} setPitches={setPitches} />
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
          className={`nav-tab ${activeTab === 'pitches' ? 'active' : ''}`}
          onClick={() => setActiveTab('pitches')}
        >
          📚 My Pitches
        </button>
      </div>
      
      <div className="dashboard-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Dashboard;
