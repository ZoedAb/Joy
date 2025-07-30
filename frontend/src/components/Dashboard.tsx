import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AudioRecorder from './AudioRecorder';
import PitchList from './PitchList';
import './Dashboard.css';

interface Pitch {
  id: number;
  title: string;
  description: string;
  transcript: string;
  created_at: string;
  user_id: number;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);

  const handleNewPitch = (newPitch: Pitch) => {
    setPitches(prev => [newPitch, ...prev]);
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
      
      <div className="dashboard-content">
        <section className="recording-section">
          <h3>Record a New Pitch</h3>
          <AudioRecorder onNewPitch={handleNewPitch} />
        </section>
        
        <section className="pitches-section">
          <h3>Your Pitches</h3>
          <PitchList pitches={pitches} setPitches={setPitches} />
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
