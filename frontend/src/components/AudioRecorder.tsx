import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './AudioRecorder.css';

interface Pitch {
  id: number;
  title: string;
  description: string;
  transcript: string;
  created_at: string;
  user_id: number;
}

interface AudioRecorderProps {
  onNewPitch: (pitch: Pitch) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onNewPitch }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { token } = useAuth();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadPitch = async () => {
    if (!audioBlob || !title.trim()) {
      setError('Please provide a title and record audio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.wav');
      formData.append('title', title);
      formData.append('description', description);

      const response = await axios.post('http://localhost:8000/pitches', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      onNewPitch(response.data);
      
      // Reset form
      setTitle('');
      setDescription('');
      setAudioBlob(null);
    } catch (err) {
      setError('Failed to upload pitch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="audio-recorder">
      {error && <div className="error">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="title">Pitch Title:</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter pitch title"
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="description">Description (optional):</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter pitch description"
          rows={3}
        />
      </div>
      
      <div className="recording-controls">
        {!isRecording ? (
          <button onClick={startRecording} className="record-btn">
            🎤 Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="stop-btn">
            ⏹️ Stop Recording
          </button>
        )}
      </div>
      
      {audioBlob && (
        <div className="audio-preview">
          <h4>Recording Preview:</h4>
          <audio controls src={URL.createObjectURL(audioBlob)} />
          <button 
            onClick={uploadPitch} 
            disabled={loading}
            className="upload-btn"
          >
            {loading ? 'Uploading...' : 'Save Pitch'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
