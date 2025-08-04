import React, { useState, useRef, useCallback, useEffect } from 'react';
import './VideoRecorder.css';

interface VideoRecorderProps {
  onVideoRecorded: (videoBlob: Blob) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  enableFaceDetection?: boolean;
  onEmotionUpdate?: (emotion: any) => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  onVideoRecorded,
  isRecording,
  onStartRecording,
  onStopRecording,
  enableFaceDetection = false,
  onEmotionUpdate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentEmotion, setCurrentEmotion] = useState<string>('😐');
  const [detectionStatus, setDetectionStatus] = useState<string>('Waiting...');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      console.log('🎥 Requesting camera and microphone permissions...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Permissions granted. Stream tracks:');
      const tracks = stream.getTracks();
      tracks.forEach((track, index) => {
        console.log(`  Track ${index}:`, track.kind, track.enabled, track.readyState);
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      setIsInitialized(true);
      setError('');
    } catch (err) {
      console.error('❌ Error accessing camera:', err);
      setError('Unable to access camera. Please ensure camera permissions are granted.');
      setHasPermission(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasPermission(false);
    setIsInitialized(false);
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setError('Camera not initialized');
      return;
    }

    // Debug: Check stream tracks
    const tracks = streamRef.current.getTracks();
    console.log('🎥 Stream tracks:', tracks.length);
    tracks.forEach((track, index) => {
      console.log(`  Track ${index}:`, track.kind, track.enabled, track.readyState);
    });

    try {
      // Check if the browser supports video/webm with audio
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') 
        ? 'video/webm;codecs=vp8,opus' 
        : 'video/webm';
      
      console.log('🎥 Using MIME type for recording:', mimeType);
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: mimeType
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('🎥 Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: 'video/webm' });
        console.log('🎥 Recording stopped. Blob size:', videoBlob.size, 'bytes');
        console.log('🎥 Number of chunks:', chunks.length);
        chunks.forEach((chunk, index) => {
          console.log(`  Chunk ${index}:`, chunk.size, 'bytes');
        });
        onVideoRecorded(videoBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      onStartRecording();
      
      // Start emotion detection if enabled - will be handled by useEffect
      if (enableFaceDetection) {
        console.log('🎭 Recording started with emotion detection enabled');
        setDetectionStatus('Starting detection...');
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  }, [onVideoRecorded, onStartRecording, enableFaceDetection]);

  // Get emoji for emotion
  const getEmotionEmoji = (emotion: string): string => {
    const emotionEmojis: { [key: string]: string } = {
      happy: '😊',
      confident: '😎',
      neutral: '😐',
      surprise: '😲',
      fear: '😰',
      sad: '😢',
      angry: '😠',
      no_face: '❓'
    };
    return emotionEmojis[emotion] || '😐';
  };

  // Analyze frame emotion (simplified version)
  const analyzeFrameEmotion = useCallback(async (frameData: string) => {
    try {
      console.log('🎥 Sending frame for emotion analysis...');
      console.log('📊 Frame data length:', frameData.length);
      
      const response = await fetch('http://localhost:8000/video/realtime-emotion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ frame: frameData })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Emotion analysis result:', result);
        
        const frame_analysis = result.frame_analysis || {};
        const emotion = frame_analysis.dominant_emotion || 'neutral';
        const face_detected = frame_analysis.face_detected || false;
        const confidence = frame_analysis.confidence || 0;
        
        console.log('🎭 Detected emotion:', emotion);
        console.log('👤 Face detected:', face_detected);
        console.log('📈 Confidence:', confidence);
        
        // Update emotion display
        const emotionEmoji = getEmotionEmoji(emotion);
        setCurrentEmotion(emotionEmoji);
        
        // Show more detailed status
        if (!face_detected) {
          console.log('⚠️ No face detected - try better lighting or positioning');
          setDetectionStatus('No face detected');
        } else if (confidence < 0.3) {
          console.log('⚠️ Low confidence - try making clearer expressions');
          setDetectionStatus('Low confidence');
        } else {
          console.log('✅ Good emotion detection!');
          setDetectionStatus('Detecting emotions');
        }
        
        // Notify parent component
        if (onEmotionUpdate) {
          onEmotionUpdate(frame_analysis);
        }
      } else {
        console.error('❌ Emotion analysis failed:', response.status, response.statusText);
        console.error('📄 Response:', await response.text());
      }
    } catch (error) {
      console.error('❌ Emotion analysis failed:', error);
    }
  }, [onEmotionUpdate]);

  // Emotion detection using simple frame analysis
  const startEmotionDetection = useCallback(() => {
    console.log('🎭 startEmotionDetection called');
    console.log('📹 videoRef.current:', !!videoRef.current);
    console.log('🎨 canvasRef.current:', !!canvasRef.current);
    console.log('📹 isRecording:', isRecording);
    
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ Video or canvas not ready for emotion detection');
      setDetectionStatus('Camera not ready');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ Canvas context not available');
      setDetectionStatus('Canvas error');
      return;
    }

    console.log('✅ Starting emotion detection loop...');
    setDetectionStatus('Starting detection...');

    const detectEmotion = () => {
      console.log('🔄 detectEmotion called, isRecording:', isRecording);
      console.log('📹 videoRef.current:', !!videoRef.current);
      console.log('🎨 canvasRef.current:', !!canvasRef.current);
      
      if (!isRecording || !videoRef.current) {
        console.log('❌ Not recording or video not ready');
        setDetectionStatus('Not recording');
        return;
      }

      try {
        // Set canvas size to match video
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        
        console.log('📐 Video dimensions:', videoWidth, 'x', videoHeight);
        
        if (videoWidth === 0 || videoHeight === 0) {
          console.log('⏳ Video dimensions not ready yet');
          setDetectionStatus('Waiting for video...');
          setTimeout(detectEmotion, 500);
          return;
        }

        canvas.width = videoWidth;
        canvas.height = videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        // Convert canvas to base64
        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        console.log('📸 Frame captured, analyzing emotion...');
        setDetectionStatus('Analyzing...');

        // Send frame for emotion analysis
        analyzeFrameEmotion(frameData);

        // Continue detection if still recording
        if (isRecording) {
          setTimeout(detectEmotion, 2000); // Analyze every 2 seconds
        }
      } catch (error) {
        console.error('❌ Error in emotion detection:', error);
        setDetectionStatus('Error detected');
      }
    };

    // Start emotion detection after a short delay
    console.log('⏰ Starting emotion detection in 1 second...');
    setTimeout(detectEmotion, 1000);
  }, [isRecording, analyzeFrameEmotion]);

  const stopEmotionDetection = useCallback(() => {
    // Emotion detection will stop automatically when isRecording becomes false
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    onStopRecording();
    stopEmotionDetection();
  }, [onStopRecording, stopEmotionDetection]);

  // Auto-initialize camera on mount
  useEffect(() => {
    initializeCamera();
    return () => {
      stopCamera();
    };
  }, [initializeCamera, stopCamera]);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording && hasPermission && !mediaRecorderRef.current) {
      startRecording();
    } else if (!isRecording && mediaRecorderRef.current) {
      stopRecording();
    }
  }, [isRecording, hasPermission, startRecording, stopRecording]);

  // Handle emotion detection start when recording begins
  useEffect(() => {
    if (isRecording && enableFaceDetection && hasPermission) {
      console.log('🎭 Starting emotion detection from useEffect');
      console.log('📹 isRecording:', isRecording);
      console.log('🎭 enableFaceDetection:', enableFaceDetection);
      console.log('📹 hasPermission:', hasPermission);
      // Small delay to ensure video is ready
      const timer = setTimeout(() => {
        console.log('⏰ Timer fired, calling startEmotionDetection');
        if (typeof startEmotionDetection === 'function') {
          console.log('✅ startEmotionDetection function found, calling it');
          startEmotionDetection();
        } else {
          console.log('❌ startEmotionDetection function not found');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isRecording, enableFaceDetection, hasPermission, startEmotionDetection]);

  return (
    <div className="video-recorder">
      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`video-preview ${isRecording ? 'recording' : ''}`}
        />
        
        {/* Hidden canvas for emotion detection */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>Recording</span>
          </div>
        )}
        
                 {/* Emotion indicator */}
         {enableFaceDetection && isRecording && (
           <div className="emotion-indicator">
             <div className="emotion-display">
               <span className="emotion-emoji">{currentEmotion}</span>
               <span className="emotion-label">Live Emotion</span>
               <div className="emotion-status">
                 <span className="status-dot"></span>
                 <span>{detectionStatus}</span>
               </div>
             </div>
           </div>
         )}
        
        {/* Error display */}
        {error && (
          <div className="error-overlay">
            <div className="error-message">
              <p>{error}</p>
              <button onClick={initializeCamera} className="retry-button">
                Retry
              </button>
            </div>
          </div>
        )}
        
        {/* No permission overlay */}
        {!hasPermission && !error && (
          <div className="permission-overlay">
            <div className="permission-message">
              <h3>Camera Access Required</h3>
              <p>Please allow camera access for video recording</p>
              <button onClick={initializeCamera} className="permission-button">
                Allow Camera
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="video-controls">
        <div className="control-buttons">
          {!isInitialized ? (
            <button
              onClick={initializeCamera}
              className="control-button init-button"
            >
              Initialize Camera
            </button>
          ) : (
            <>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!hasPermission}
                  className="control-button start-button"
                >
                  Start Video Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="control-button stop-button"
                >
                  Stop Recording
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Settings */}
        <div className="video-settings">
          <label className="setting-item">
            <input
              type="checkbox"
              checked={enableFaceDetection}
              onChange={() => {}}
              disabled={isRecording}
            />
            <span>Real-time Emotion Detection</span>
          </label>
          
          {/* Debug button for testing */}
          {isRecording && enableFaceDetection && (
            <button
              onClick={() => {
                console.log('🧪 Manual emotion test triggered');
                if (videoRef.current && canvasRef.current) {
                  const canvas = canvasRef.current;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    ctx.drawImage(videoRef.current, 0, 0);
                    const frameData = canvas.toDataURL('image/jpeg', 0.8);
                    console.log('🧪 Manual frame capture:', frameData.length, 'chars');
                    analyzeFrameEmotion(frameData);
                  }
                }
              }}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                marginLeft: '10px'
              }}
            >
              Test Emotion
            </button>
          )}
          
          {/* Simple test button */}
          {isRecording && (
            <button
              onClick={() => {
                console.log('🧪 Simple test triggered');
                setDetectionStatus('Testing...');
                setCurrentEmotion('😊');
                setTimeout(() => {
                  setDetectionStatus('Test complete');
                  setCurrentEmotion('😐');
                }, 2000);
              }}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                marginLeft: '10px'
              }}
            >
              Test UI
            </button>
          )}
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="video-status">
        <div className={`status-item ${hasPermission ? 'status-good' : 'status-bad'}`}>
          <span className="status-icon">{hasPermission ? '✓' : '✗'}</span>
          <span>Camera Access</span>
        </div>
        
        <div className={`status-item ${isInitialized ? 'status-good' : 'status-neutral'}`}>
          <span className="status-icon">{isInitialized ? '✓' : '○'}</span>
          <span>Camera Ready</span>
        </div>
        
        {enableFaceDetection && (
          <div className={`status-item ${isRecording ? 'status-good' : 'status-neutral'}`}>
            <span className="status-icon">{isRecording ? '✓' : '○'}</span>
            <span>Emotion Detection</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
