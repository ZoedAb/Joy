import asyncio
import json
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
import librosa
import soundfile as sf
from io import BytesIO
import tempfile
import os

from voice_analysis import ml_voice_analyzer
from investor_ai import investor_ai

logger = logging.getLogger(__name__)

class RealTimeAnalyzer:
    """
    Real-time voice analysis for streaming audio data
    Processes audio chunks and provides live feedback
    """
    
    def __init__(self):
        """Initialize real-time analyzer"""
        self.chunk_size = 1024  # Audio chunk size
        self.sample_rate = 16000  # Standard sample rate
        self.buffer = []  # Audio buffer
        self.transcript_buffer = ""  # Transcript accumulation
        self.analysis_history = []  # Store analysis results
        self.session_data = {}  # Session-specific data
        self.is_processing = False
        
        # Real-time metrics
        self.live_metrics = {
            'volume_level': 0.0,
            'speaking_pace': 0.0,
            'confidence_trend': [],
            'emotion_trend': [],
            'pitch_variation': 0.0,
            'speaking_time': 0.0,
            'pause_count': 0,
            'last_update': None
        }
        
        # Chunk processing settings
        self.min_chunk_duration = 5.0  # Minimum seconds for transcription (increased)
        self.max_buffer_size = 30.0  # Maximum buffer duration in seconds
        self.transcription_threshold = 3.0  # Minimum audio length for transcription
        self.silence_threshold = 0.01  # Threshold for silence detection
        
    async def start_session(self, session_id: str, user_id: int) -> Dict[str, Any]:
        """Start a new real-time analysis session"""
        self.session_data[session_id] = {
            'user_id': user_id,
            'start_time': datetime.now(),
            'total_chunks': 0,
            'total_audio_duration': 0.0,
            'accumulated_transcript': "",
            'analysis_results': []
        }
        
        # Reset metrics
        self.live_metrics = {
            'volume_level': 0.0,
            'speaking_pace': 0.0,
            'confidence_trend': [],
            'emotion_trend': [],
            'pitch_variation': 0.0,
            'speaking_time': 0.0,
            'pause_count': 0,
            'last_update': datetime.now().isoformat()
        }
        
        logger.info(f"Started real-time session: {session_id}")
        return {
            'session_id': session_id,
            'status': 'started',
            'metrics': self.live_metrics
        }
    
    async def process_audio_chunk(
        self, 
        session_id: str, 
        audio_data: bytes,
        emit_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Process incoming audio chunk and return real-time analysis"""
        if session_id not in self.session_data:
            raise ValueError(f"Session {session_id} not found")
        
        try:
            # Convert audio bytes to numpy array
            audio_array = self._bytes_to_audio_array(audio_data)
            
            # Add to buffer
            self.buffer.extend(audio_array)
            
            # Update session data
            session = self.session_data[session_id]
            session['total_chunks'] += 1
            
            # Calculate real-time metrics
            metrics = await self._calculate_live_metrics(audio_array)
            
            # Process buffer if sufficient data accumulated and contains speech
            analysis_result = None
            buffer_duration = len(self.buffer) / self.sample_rate
            
            if buffer_duration > self.transcription_threshold:
                # Check if buffer contains meaningful audio (not just silence)
                recent_audio = np.array(self.buffer[-int(self.sample_rate * 2):])  # Last 2 seconds
                audio_energy = np.mean(recent_audio ** 2) if len(recent_audio) > 0 else 0
                
                if audio_energy > self.silence_threshold:
                    analysis_result = await self._process_buffer_chunk(session_id)
                    
                    # Emit real-time updates if callback provided
                    if emit_callback and analysis_result:
                        await emit_callback('analysis_update', {
                            'session_id': session_id,
                            'metrics': metrics,
                            'analysis': analysis_result,
                            'timestamp': datetime.now().isoformat()
                        })
            
            # Always emit live metrics
            if emit_callback:
                await emit_callback('live_metrics', {
                    'session_id': session_id,
                    'metrics': metrics,
                    'timestamp': datetime.now().isoformat()
                })
            
            return {
                'session_id': session_id,
                'chunk_processed': True,
                'live_metrics': metrics,
                'analysis': analysis_result
            }
            
        except Exception as e:
            logger.error(f"Error processing audio chunk: {e}")
            return {
                'session_id': session_id,
                'error': f"Processing failed: {str(e)}",
                'chunk_processed': False
            }
    
    async def _calculate_live_metrics(self, audio_array: np.ndarray) -> Dict[str, Any]:
        """Calculate real-time audio metrics"""
        try:
            # Volume level (RMS)
            volume_level = float(np.sqrt(np.mean(audio_array ** 2)))
            
            # Pitch variation using zero crossing rate
            zcr = librosa.feature.zero_crossing_rate(audio_array)[0]
            pitch_variation = float(np.std(zcr))
            
            # Speech detection (simple energy-based)
            is_speaking = volume_level > 0.01  # Threshold for speech detection
            
            # Update metrics
            self.live_metrics.update({
                'volume_level': round(volume_level * 100, 2),  # Convert to percentage
                'pitch_variation': round(pitch_variation, 3),
                'is_speaking': bool(is_speaking),  # Ensure boolean conversion
                'last_update': datetime.now().isoformat()
            })
            
            # Speaking time tracking
            if is_speaking:
                chunk_duration = len(audio_array) / self.sample_rate
                self.live_metrics['speaking_time'] += chunk_duration
            
            return self.live_metrics
            
        except Exception as e:
            logger.error(f"Error calculating live metrics: {e}")
            return self.live_metrics
    
    async def _process_buffer_chunk(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Process accumulated buffer for analysis with improved reliability"""
        try:
            if self.is_processing:
                logger.debug("Already processing, skipping this chunk")
                return None
            
            self.is_processing = True
            
            # Convert buffer to audio array with validation
            buffer_array = np.array(self.buffer, dtype=np.float32)
            
            if len(buffer_array) == 0:
                logger.warning("Empty buffer for processing")
                return None
            
            # Ensure minimum length for transcription
            duration = len(buffer_array) / self.sample_rate
            if duration < self.transcription_threshold:
                logger.debug(f"Buffer too short for transcription: {duration:.2f}s")
                return None
            
            # Check audio quality before processing
            energy = np.mean(buffer_array ** 2)
            if energy < self.silence_threshold:
                logger.debug(f"Buffer contains mostly silence (energy: {energy:.6f})")
                return None
            
            # Save to temporary file with error handling
            temp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    temp_path = temp_file.name
                
                # Write audio with librosa for better compatibility
                sf.write(temp_path, buffer_array, self.sample_rate)
                
                # Verify file was written correctly
                if not os.path.exists(temp_path) or os.path.getsize(temp_path) < 1000:
                    logger.error("Failed to write valid audio file")
                    return None
                
                # Transcribe chunk
                chunk_transcript = await self._transcribe_audio_chunk(temp_path)
                
                session = self.session_data[session_id]
                
                # Even if transcription fails, we can still do audio analysis
                analysis_result = {
                    'chunk_id': session['total_chunks'],
                    'transcript': chunk_transcript or "",
                    'timestamp': datetime.now().isoformat(),
                    'duration': duration,
                    'audio_energy': float(energy),
                    'has_speech': bool(energy > self.silence_threshold)  # Ensure boolean is explicitly converted
                }
                
                if chunk_transcript:
                    # Accumulate transcript
                    session['accumulated_transcript'] += " " + chunk_transcript
                    
                    # Perform ML analysis on transcript chunk
                    try:
                        analysis = await ml_voice_analyzer.analyze_transcript(
                            transcript=chunk_transcript,
                            audio_duration=duration,
                            audio_file_path=temp_path
                        )
                        
                        analysis_result['analysis'] = analysis
                        
                        # Update trends if analysis successful
                        if 'error' not in analysis:
                            self._update_analysis_trends(analysis)
                            
                    except Exception as e:
                        logger.warning(f"ML analysis failed: {e}")
                        analysis_result['analysis'] = {
                            'error': f'Analysis failed: {str(e)}',
                            'confidence_score': 0
                        }
                else:
                    # No transcript, but we can still provide basic audio metrics
                    analysis_result['analysis'] = {
                        'message': 'Continuing to listen...',
                        'audio_quality': 'detected' if energy > self.silence_threshold else 'silent',
                        'confidence_score': 0
                    }
                
                # Store analysis result
                session['analysis_results'].append(analysis_result)
                
                # Clear part of buffer to maintain memory efficiency
                self._manage_buffer()
                
                logger.debug(f"Processed buffer chunk: {duration:.2f}s, transcript: {bool(chunk_transcript)}")
                return analysis_result
                
            except Exception as e:
                logger.error(f"Error processing buffer: {e}")
                return None
                
            finally:
                # Clean up temporary file
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
                
                self.is_processing = False
            
        except Exception as e:
            logger.error(f"Critical error in buffer processing: {e}")
            self.is_processing = False
            return None
    
    async def _transcribe_audio_chunk(self, audio_path: str) -> Optional[str]:
        """Transcribe audio chunk with improved error handling"""
        try:
            # Check file exists and has content
            if not os.path.exists(audio_path):
                logger.warning(f"Audio file not found: {audio_path}")
                return None
            
            # Check file size
            file_size = os.path.getsize(audio_path)
            if file_size < 1000:  # Less than 1KB likely empty or corrupted
                logger.warning(f"Audio file too small ({file_size} bytes): {audio_path}")
                return None
            
            # Check audio duration
            try:
                y, sr = librosa.load(audio_path, sr=16000)
                duration = len(y) / sr
                if duration < 1.0:  # Less than 1 second
                    logger.debug(f"Audio too short for transcription ({duration:.2f}s)")
                    return None
                    
                # Check if audio has meaningful content (not just silence)
                energy = np.mean(y ** 2)
                if energy < 0.001:  # Very quiet audio
                    logger.debug(f"Audio too quiet for transcription (energy: {energy:.6f})")
                    return None
                    
            except Exception as e:
                logger.warning(f"Failed to analyze audio file: {e}")
                # Continue with transcription attempt anyway
            
            # Try optimized transcription first
            try:
                from optimized_speech_to_text import optimized_stt
                result = await optimized_stt.transcribe_with_quality_check(audio_path)
                
                if result.get('transcript'):
                    logger.debug(f"Transcription successful: {result['transcript'][:50]}...")
                    return result['transcript']
                elif result.get('skipped_reason'):
                    logger.debug(f"Transcription skipped: {result['skipped_reason']}")
                    return None
                elif result.get('error'):
                    logger.warning(f"Optimized transcription failed: {result['error']}")
                else:
                    logger.warning(f"Optimized transcription failed: Unknown error")
                    
            except ImportError:
                logger.debug("Optimized speech-to-text not available, using fallback")
            except Exception as e:
                logger.warning(f"Optimized transcription error: {e}")
            
            # Fallback to basic transcription
            try:
                from speech_to_text import transcribe_audio
                transcript = await transcribe_audio(audio_path)
                if transcript and not transcript.startswith("Transcription failed"):
                    logger.debug(f"Fallback transcription successful")
                    return transcript
                else:
                    logger.debug(f"Fallback transcription result: {transcript}")
                    return None
                    
            except Exception as fallback_error:
                logger.warning(f"Fallback transcription failed: {fallback_error}")
            
            # If all transcription methods fail, check if it's just silence
            try:
                y, sr = librosa.load(audio_path, sr=16000)
                energy = np.mean(y ** 2)
                if energy < 0.001:
                    logger.debug("Audio appears to be silence - no transcription needed")
                    return None
                else:
                    logger.info("Audio contains sound but transcription failed - may be non-speech")
                    return None
            except Exception as e:
                logger.debug(f"Could not analyze audio file: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Critical error in transcription: {e}")
            return None
    
    def _update_analysis_trends(self, analysis: Dict[str, Any]):
        """Update trend data from analysis results"""
        try:
            # Confidence trend
            confidence_score = analysis.get('confidence_score', 0)
            self.live_metrics['confidence_trend'].append(confidence_score)
            
            # Keep only recent trend data (last 10 points)
            if len(self.live_metrics['confidence_trend']) > 10:
                self.live_metrics['confidence_trend'] = self.live_metrics['confidence_trend'][-10:]
            
            # Emotion trend
            emotion_analysis = analysis.get('emotion_analysis', {})
            if 'dominant_emotion' in emotion_analysis:
                emotion_entry = {
                    'emotion': emotion_analysis['dominant_emotion'],
                    'timestamp': datetime.now().isoformat()
                }
                self.live_metrics['emotion_trend'].append(emotion_entry)
                
                # Keep only recent emotions
                if len(self.live_metrics['emotion_trend']) > 10:
                    self.live_metrics['emotion_trend'] = self.live_metrics['emotion_trend'][-10:]
            
            # Speaking pace from analysis
            speaking_pace = analysis.get('speaking_pace', {})
            if 'words_per_minute' in speaking_pace:
                self.live_metrics['speaking_pace'] = speaking_pace['words_per_minute']
            
        except Exception as e:
            logger.error(f"Error updating trends: {e}")
    
    def _manage_buffer(self):
        """Manage buffer size to prevent memory issues"""
        max_buffer_length = int(self.max_buffer_size * self.sample_rate)
        
        if len(self.buffer) > max_buffer_length:
            # Keep only the most recent data
            keep_length = int(max_buffer_length * 0.7)  # Keep 70% of max
            self.buffer = self.buffer[-keep_length:]
    
    def _bytes_to_audio_array(self, audio_bytes: bytes) -> np.ndarray:
        """Convert audio bytes to numpy array with better WebSocket support"""
        try:
            # Check if it's WebM/Opus format (common for WebSocket audio)
            if len(audio_bytes) < 4:
                logger.warning(f"Audio chunk too small: {len(audio_bytes)} bytes")
                return np.array([])
            
            # For WebSocket audio, we might receive different formats
            # Try to detect and handle the format appropriately
            
            # First, try as raw PCM 16-bit (most common)
            try:
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                # Normalize to float32 [-1, 1]
                audio_array = audio_array.astype(np.float32) / 32768.0
                
                # Validate the audio data
                if len(audio_array) == 0:
                    logger.warning("Empty audio array after conversion")
                    return np.array([])
                
                # Check for reasonable audio values
                max_val = np.max(np.abs(audio_array))
                if max_val > 10:  # Unreasonably large values
                    logger.warning(f"Audio values too large: {max_val}, trying different format")
                    # Try as float32 directly
                    audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
                
                return audio_array
                
            except Exception as e:
                logger.warning(f"Failed to convert as PCM16: {e}")
                
                # Try as float32 directly
                try:
                    audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
                    return audio_array
                except Exception as e2:
                    logger.error(f"Failed to convert audio format: {e2}")
                    return np.array([])
                    
        except Exception as e:
            logger.error(f"Error converting audio bytes: {e}")
            return np.array([])
    
    async def generate_live_investor_response(
        self, 
        session_id: str,
        emit_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Generate real-time investor response based on current session"""
        try:
            if session_id not in self.session_data:
                raise ValueError(f"Session {session_id} not found")
            
            session = self.session_data[session_id]
            
            # Get accumulated data
            full_transcript = session['accumulated_transcript']
            recent_analysis = session['analysis_results'][-1] if session['analysis_results'] else None
            
            if not full_transcript.strip():
                return {
                    'type': 'investor_response',
                    'message': "I'm listening... please continue with your pitch.",
                    'investor_type': 'encouraging'
                }
            
            # Generate contextual investor response
            if recent_analysis:
                analysis_data = json.dumps(recent_analysis['analysis'], default=str)
            else:
                analysis_data = None
            
            response = await investor_ai.generate_investor_response(
                transcript=full_transcript,
                analysis_result=analysis_data
            )
            
            # Add real-time context
            response['session_context'] = {
                'total_speaking_time': self.live_metrics['speaking_time'],
                'confidence_trend': self.live_metrics['confidence_trend'][-3:],  # Last 3 points
                'current_pace': self.live_metrics['speaking_pace']
            }
            
            # Emit real-time investor response
            if emit_callback:
                await emit_callback('investor_response', {
                    'session_id': session_id,
                    'response': response,
                    'timestamp': datetime.now().isoformat()
                })
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating live investor response: {e}")
            return {
                'type': 'investor_response',
                'error': f"Response generation failed: {str(e)}",
                'message': "I'm having trouble processing your pitch right now. Please continue."
            }
    
    async def end_session(self, session_id: str) -> Dict[str, Any]:
        """End real-time session and return summary"""
        try:
            if session_id not in self.session_data:
                raise ValueError(f"Session {session_id} not found")
            
            session = self.session_data[session_id]
            end_time = datetime.now()
            
            # Calculate session summary
            total_duration = (end_time - session['start_time']).total_seconds()
            
            summary = {
                'session_id': session_id,
                'total_duration': total_duration,
                'speaking_time': self.live_metrics['speaking_time'],
                'speaking_ratio': self.live_metrics['speaking_time'] / total_duration if total_duration > 0 else 0,
                'total_chunks': session['total_chunks'],
                'final_transcript': session['accumulated_transcript'],
                'analysis_count': len(session['analysis_results']),
                'confidence_trend': self.live_metrics['confidence_trend'],
                'emotion_summary': self._summarize_emotions(),
                'final_metrics': self.live_metrics.copy()
            }
            
            # Clean up session data
            del self.session_data[session_id]
            
            # Reset for next session
            self.buffer = []
            self.transcript_buffer = ""
            
            logger.info(f"Ended real-time session: {session_id}")
            return summary
            
        except Exception as e:
            logger.error(f"Error ending session: {e}")
            return {
                'session_id': session_id,
                'error': f"Session end failed: {str(e)}"
            }
    
    def _summarize_emotions(self) -> Dict[str, Any]:
        """Summarize emotion trends from the session"""
        try:
            emotions = [entry['emotion'] for entry in self.live_metrics['emotion_trend']]
            if not emotions:
                return {'dominant_emotion': 'neutral', 'emotion_changes': 0}
            
            # Count emotion frequencies
            emotion_counts = {}
            for emotion in emotions:
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            
            # Find dominant emotion
            dominant_emotion = max(emotion_counts, key=emotion_counts.get)
            
            # Count emotion changes
            emotion_changes = sum(1 for i in range(1, len(emotions)) if emotions[i] != emotions[i-1])
            
            return {
                'dominant_emotion': dominant_emotion,
                'emotion_distribution': emotion_counts,
                'emotion_changes': emotion_changes,
                'emotional_stability': 'stable' if emotion_changes < 3 else 'variable'
            }
            
        except Exception as e:
            logger.error(f"Error summarizing emotions: {e}")
            return {'dominant_emotion': 'neutral', 'emotion_changes': 0}

# Global real-time analyzer instance
realtime_analyzer = RealTimeAnalyzer()
