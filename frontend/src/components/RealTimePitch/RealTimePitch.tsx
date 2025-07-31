import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './RealTimePitch.css';

interface LiveMetrics {
  volume_level: number;
  speaking_pace: number;
  confidence_trend: number[];
  emotion_trend: Array<{emotion: string; timestamp: string}>;
  pitch_variation: number;
  speaking_time: number;
  pause_count: number;
  is_speaking: boolean;
  last_update: string;
}

interface AnalysisUpdate {
  chunk_id: number;
  transcript: string;
  analysis: any;
  timestamp: string;
  duration: number;
}

interface InvestorResponse {
  type: string;
  message: string;
  investor_type: string;
  questions?: string[];
  feedback?: string[];
  interest_level?: number;
}

const RealTimePitch: React.FC = () => {
  const { user, token } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [analysisUpdates, setAnalysisUpdates] = useState<AnalysisUpdate[]>([]);
  const [investorResponses, setInvestorResponses] = useState<InvestorResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Refs
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // WebSocket connection
  const connectWebSocket = useCallback(async () => {
    if (!sessionId || !token) return;

    try {
      setConnectionStatus('connecting');
      const wsUrl = `ws://localhost:8000/ws/realtime/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        // Send authentication
        ws.send(JSON.stringify({ token }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection failed');
        setConnectionStatus('disconnected');
      };

      websocketRef.current = ws;
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setError('Failed to connect to real-time service');
      setConnectionStatus('disconnected');
    }
  }, [sessionId, token]);

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    const { event, data } = message;

    switch (event) {
      case 'connected':
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        break;

      case 'live_metrics':
        setLiveMetrics(data.metrics);
        break;

      case 'analysis_update':
        const update: AnalysisUpdate = data.analysis;
        setAnalysisUpdates(prev => [...prev, update]);
        setCurrentTranscript(prev => prev + ' ' + update.transcript);
        break;

      case 'investor_response':
        const response: InvestorResponse = data.response;
        setInvestorResponses(prev => [...prev, response]);
        break;

      case 'session_ended':
        console.log('Session ended:', data);
        stopRecording();
        break;

      case 'error':
        setError(data.message);
        break;

      default:
        console.log('Unknown WebSocket event:', event, data);
    }
  };

  // Start session
  const startSession = async () => {
    try {
      setError(null);
      const response = await axios.post('http://localhost:8000/realtime/start-session', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSessionId(response.data.session_id);
      return response.data.session_id;
    } catch (error) {
      console.error('Error starting session:', error);
      setError('Failed to start real-time session');
      throw error;
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      
      // Start session first
      const newSessionId = await startSession();
      setSessionId(newSessionId);
      
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
          // Send audio chunk via WebSocket
          websocketRef.current.send(event.data);
        }
      };

      // Start recording in chunks
      mediaRecorder.start(1000); // 1 second chunks
      setIsRecording(true);

      // Connect WebSocket after starting recording
      setTimeout(() => {
        connectWebSocket();
      }, 100);

    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (websocketRef.current) {
      // Send end session command
      websocketRef.current.send(JSON.stringify({ type: 'end_session' }));
      websocketRef.current.close();
    }

    setIsRecording(false);
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  // Request investor response
  const requestInvestorResponse = () => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ 
        type: 'request_investor_response' 
      }));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Format confidence trend for display
  const getConfidenceTrend = () => {
    if (!liveMetrics?.confidence_trend.length) return 'No data';
    const latest = liveMetrics.confidence_trend.slice(-3);
    const avg = latest.reduce((a, b) => a + b, 0) / latest.length;
    return `${avg.toFixed(1)}%`;
  };

  // Get volume indicator
  const getVolumeIndicator = () => {
    if (!liveMetrics) return '';
    const volume = liveMetrics.volume_level;
    if (volume < 10) return '🔇';
    if (volume < 30) return '🔈';
    if (volume < 60) return '🔉';
    return '🔊';
  };

  // Get emotion indicator
  const getLatestEmotion = () => {
    if (!liveMetrics?.emotion_trend.length) return '😐';
    const latest = liveMetrics.emotion_trend[liveMetrics.emotion_trend.length - 1];
    const emotionEmojis: { [key: string]: string } = {
      joy: '😊',
      confidence: '😎',
      optimism: '🙂',
      surprise: '😲',
      fear: '😰',
      sadness: '😢',
      anger: '😠',
      neutral: '😐'
    };
    return emotionEmojis[latest.emotion] || '😐';
  };

  return (
    <div className="realtime-pitch">
      <h2>Real-Time Pitch Analysis</h2>
      
      {/* Connection Status */}
      <div className={`connection-status ${connectionStatus}`}>
        <span className="status-indicator"></span>
        {connectionStatus === 'connected' && '🟢 Connected'}
        {connectionStatus === 'connecting' && '🟡 Connecting...'}
        {connectionStatus === 'disconnected' && '🔴 Disconnected'}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {/* Recording Controls */}
      <div className="recording-controls">
        {!isRecording ? (
          <button 
            className="start-button" 
            onClick={startRecording}
            disabled={connectionStatus === 'connecting'}
          >
            🎤 Start Real-Time Pitch
          </button>
        ) : (
          <div className="recording-actions">
            <button className="stop-button" onClick={stopRecording}>
              ⏹️ Stop Recording
            </button>
            <button 
              className="investor-button" 
              onClick={requestInvestorResponse}
              disabled={!isConnected}
            >
              💼 Ask Investor
            </button>
          </div>
        )}
      </div>

      {/* Live Metrics Dashboard */}
      {liveMetrics && isRecording && (
        <div className="live-metrics">
          <h3>📊 Live Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon">{getVolumeIndicator()}</div>
              <div className="metric-value">{liveMetrics.volume_level.toFixed(1)}%</div>
              <div className="metric-label">Volume</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">⚡</div>
              <div className="metric-value">{getConfidenceTrend()}</div>
              <div className="metric-label">Confidence</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">{getLatestEmotion()}</div>
              <div className="metric-value">
                {liveMetrics.emotion_trend.length > 0 
                  ? liveMetrics.emotion_trend[liveMetrics.emotion_trend.length - 1].emotion
                  : 'neutral'
                }
              </div>
              <div className="metric-label">Emotion</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">⏱️</div>
              <div className="metric-value">{liveMetrics.speaking_time.toFixed(1)}s</div>
              <div className="metric-label">Speaking Time</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">🗣️</div>
              <div className="metric-value">
                {liveMetrics.speaking_pace > 0 ? `${liveMetrics.speaking_pace} WPM` : 'Calculating...'}
              </div>
              <div className="metric-label">Pace</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">🎵</div>
              <div className="metric-value">{liveMetrics.pitch_variation.toFixed(3)}</div>
              <div className="metric-label">Pitch Variation</div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Transcript */}
      {currentTranscript && (
        <div className="live-transcript">
          <h3>📝 Live Transcript</h3>
          <div className="transcript-text">
            {currentTranscript}
          </div>
        </div>
      )}

      {/* Investor Responses */}
      {investorResponses.length > 0 && (
        <div className="investor-responses">
          <h3>💼 Investor Feedback</h3>
          {investorResponses.map((response, index) => (
            <div key={index} className="investor-response">
              <div className="response-header">
                <span className="investor-type">{response.investor_type}</span>
                {response.interest_level && (
                  <span className="interest-level">
                    Interest: {response.interest_level}/10
                  </span>
                )}
              </div>
              <div className="response-message">{response.message}</div>
              
              {response.questions && response.questions.length > 0 && (
                <div className="response-questions">
                  <strong>Questions:</strong>
                  <ul>
                    {response.questions.map((question, qIndex) => (
                      <li key={qIndex}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {response.feedback && response.feedback.length > 0 && (
                <div className="response-feedback">
                  <strong>Feedback:</strong>
                  <ul>
                    {response.feedback.map((feedback, fIndex) => (
                      <li key={fIndex}>{feedback}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Analysis Updates */}
      {analysisUpdates.length > 0 && (
        <div className="analysis-updates">
          <h3>🔍 Analysis Updates</h3>
          <div className="updates-list">
            {analysisUpdates.slice(-3).map((update, index) => (
              <div key={index} className="analysis-update">
                <div className="update-header">
                  <span className="chunk-id">Chunk {update.chunk_id}</span>
                  <span className="timestamp">
                    {new Date(update.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="update-transcript">"{update.transcript}"</div>
                {update.analysis && !update.analysis.error && (
                  <div className="update-metrics">
                    <span>Confidence: {update.analysis.confidence_score}%</span>
                    <span>Grade: {update.analysis.overall_grade}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimePitch;
