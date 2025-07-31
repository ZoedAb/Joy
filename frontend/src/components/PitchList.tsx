import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import AnalysisView from './AnalysisView';
import './PitchList.css';

interface Pitch {
  id: number;
  title: string;
  description: string;
  transcript: string;
  analysis_result?: string;
  created_at: string;
  user_id: number;
}

interface PitchListProps {
  pitches: Pitch[];
  setPitches: React.Dispatch<React.SetStateAction<Pitch[]>>;
}

const PitchList: React.FC<PitchListProps> = ({ pitches, setPitches }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<number | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchPitches();
  }, []);

  const fetchPitches = async () => {
    try {
      const response = await axios.get('http://localhost:8000/pitches', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setPitches(response.data);
    } catch (err) {
      setError('Failed to load pitches');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async (pitchId: number) => {
    try {
      setPlayingAudio(pitchId);
      
      // Create authenticated request to get audio
      const response = await axios.get(`http://localhost:8000/audio/${pitchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });
      
      // Create blob URL and play audio
      const audioBlob = response.data;
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
        alert('Failed to play audio');
      };
      
      await audio.play();
      
    } catch (err) {
      setPlayingAudio(null);
      console.error('Error playing audio:', err);
      alert('Failed to play audio');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="loading">Loading pitches...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="pitch-list">
      {pitches.length === 0 ? (
        <div className="no-pitches">
          <p>No pitches recorded yet. Start by recording your first pitch!</p>
        </div>
      ) : (
        <div className="pitches-grid">
          {pitches.map((pitch) => (
            <div key={pitch.id} className="pitch-card">
              <div className="pitch-header">
                <h4>{pitch.title}</h4>
                <span className="pitch-date">{formatDate(pitch.created_at)}</span>
              </div>
              
              {pitch.description && (
                <div className="pitch-description">
                  <p>{pitch.description}</p>
                </div>
              )}
              
              <div className="pitch-transcript">
                <h5>Transcript:</h5>
                <p className="transcript-text">{pitch.transcript}</p>
              </div>
              
              <div className="pitch-actions">
                <button 
                  className={`play-btn ${playingAudio === pitch.id ? 'playing' : ''}`}
                  onClick={() => playAudio(pitch.id)}
                  disabled={playingAudio === pitch.id}
                  title="Play audio recording"
                >
                  {playingAudio === pitch.id ? '🔊 Playing...' : '🎵 Play Audio'}
                </button>
                
                {pitch.analysis_result && (
                  <button 
                    className="analysis-btn"
                    onClick={() => setShowAnalysis(pitch.id)}
                    title="View AI analysis and investor feedback"
                  >
                    📊 View Analysis
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showAnalysis && (
        <AnalysisView 
          pitchId={showAnalysis} 
          onClose={() => setShowAnalysis(null)} 
        />
      )}
    </div>
  );
};

export default PitchList;
