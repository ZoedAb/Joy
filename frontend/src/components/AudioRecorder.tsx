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
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { token } = useAuth();

  const getSupportedMimeType = () => {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
      'audio/ogg;codecs=opus'
    ];
    
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Using MIME type: ${mimeType}`);
        return mimeType;
      }
    }
    
    console.log('No specific MIME type supported, using default');
    return '';
  };

  const startRecording = async () => {
    try {
      // Stop any existing recording
      if (mediaRecorderRef.current && isRecording) {
        stopRecording();
      }

      // Request microphone access with more specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,  // Lower sample rate for better compatibility
          channelCount: 1,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      
      console.log('Starting recording with MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Data available: ${event.data.size} bytes`);
          chunksRef.current.push(event.data);
        } else {
          console.warn('Empty data chunk received');
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log(`Recording stopped. Total chunks: ${chunksRef.current.length}`);
        const totalSize = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log(`Total recorded data: ${totalSize} bytes`);
        
        if (totalSize > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/wav' });
          console.log(`Created blob: ${blob.size} bytes, type: ${blob.type}`);
          
          // Additional validation
          if (blob.size < 1024) {
            setError('Recording too short. Please record for at least a few seconds.');
            return;
          }
          
          setAudioBlob(blob);
        } else {
          console.error('No audio data recorded');
          setError('No audio data was recorded. Please try again.');
        }
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Clear duration
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        setRecordingDuration(0);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed. Please try again.');
        setIsRecording(false);
      };
      
      // Start recording with smaller time slices for more frequent data
      mediaRecorder.start(500); // Collect data every 500ms
      setIsRecording(true);
      setError('');
      
      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Check minimum recording duration
      if (recordingDuration < 3) {
        setError('Please record for at least 3 seconds.');
        return;
      }
      
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const validateAudioBlob = (blob: Blob): boolean => {
    if (!blob || blob.size === 0) {
      setError('No audio data available. Please record again.');
      return false;
    }
    
    if (blob.size < 1024) { // Less than 1KB
      setError('Recording too short. Please record for at least a few seconds.');
      return false;
    }
    
    return true;
  };

  const uploadPitch = async () => {
    if (!audioBlob || !title.trim()) {
      setError('Please provide a title and record audio');
      return;
    }

    if (!validateAudioBlob(audioBlob)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      
      // Determine file extension based on blob type
      let filename = 'recording';
      if (audioBlob.type.includes('webm')) {
        filename += '.webm';
      } else if (audioBlob.type.includes('mp4')) {
        filename += '.mp4';
      } else if (audioBlob.type.includes('ogg')) {
        filename += '.ogg';
      } else {
        filename += '.wav';
      }
      
      formData.append('audio_file', audioBlob, filename);
      formData.append('title', title);
      formData.append('description', description);

      console.log(`Uploading audio: ${filename}, size: ${audioBlob.size} bytes`);

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
      console.error('Upload error:', err);
      setError('Failed to upload pitch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <div className="recording-status">
            <button onClick={stopRecording} className="stop-btn">
              ⏹️ Stop Recording
            </button>
            <span className="recording-timer">
              Recording: {formatDuration(recordingDuration)}
            </span>
          </div>
        )}
      </div>
      
      {audioBlob && (
        <div className="audio-preview">
          <h4>Recording Preview:</h4>
          <p>File size: {(audioBlob.size / 1024).toFixed(1)} KB</p>
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
