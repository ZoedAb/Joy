import whisper
import asyncio
import logging
import tempfile
import os
import numpy as np
import librosa
from typing import Optional
import threading
from concurrent.futures import ThreadPoolExecutor
import time

logger = logging.getLogger(__name__)

class OptimizedSpeechToText:
    """
    Optimized speech-to-text service for real-time processing
    Uses Whisper with performance optimizations and chunking
    """
    
    def __init__(self):
        """Initialize the optimized speech-to-text service"""
        self.model = None
        self.model_loaded = False
        self.executor = ThreadPoolExecutor(max_workers=2)  # Limit concurrent transcriptions
        self.model_lock = threading.Lock()
        self.load_model()
    
    def load_model(self):
        """Load Whisper model with optimization"""
        try:
            with self.model_lock:
                if not self.model_loaded:
                    logger.info("Loading optimized Whisper model...")
                    # Use base model for better speed/accuracy balance
                    self.model = whisper.load_model("base")
                    self.model_loaded = True
                    logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.model_loaded = False
    
    async def transcribe_chunk(self, audio_file_path: str, language: str = "en") -> Optional[str]:
        """
        Transcribe audio chunk with optimization for real-time processing
        """
        try:
            if not self.model_loaded:
                logger.warning("Whisper model not loaded, attempting to reload...")
                self.load_model()
                if not self.model_loaded:
                    return None
            
            # Run transcription in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._transcribe_sync,
                audio_file_path,
                language
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return None
    
    def _transcribe_sync(self, audio_file_path: str, language: str) -> Optional[str]:
        """Synchronous transcription method"""
        try:
            start_time = time.time()
            
            # Transcribe with optimized parameters for speed
            result = self.model.transcribe(
                audio_file_path,
                language=language,
                task="transcribe",
                fp16=False,  # Disable fp16 for CPU compatibility
                verbose=False,  # Reduce output
                word_timestamps=False,  # Disable word timestamps for speed
                condition_on_previous_text=False,  # Disable context for chunks
                temperature=0.0,  # Deterministic output
                compression_ratio_threshold=2.4,  # Default threshold
                logprob_threshold=-1.0,  # Default threshold
                no_speech_threshold=0.6  # Higher threshold for better silence detection
            )
            
            transcription_time = time.time() - start_time
            logger.debug(f"Transcription completed in {transcription_time:.2f}s")
            
            # Extract text from result
            if result and "text" in result:
                text = result["text"].strip()
                if len(text) > 3:  # Minimum meaningful length
                    return text
            
            return None
            
        except Exception as e:
            logger.error(f"Sync transcription error: {e}")
            return None
    
    async def transcribe_streaming_chunk(
        self, 
        audio_data: bytes, 
        sample_rate: int = 16000,
        language: str = "en"
    ) -> Optional[str]:
        """
        Transcribe streaming audio data directly from bytes
        """
        try:
            # Create temporary file for audio data
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                
                # Write audio data to temporary file
                import soundfile as sf
                
                # Convert bytes to numpy array (assuming 16-bit PCM)
                audio_array = np.frombuffer(audio_data, dtype=np.int16)
                audio_array = audio_array.astype(np.float32) / 32768.0
                
                # Write to file
                sf.write(temp_path, audio_array, sample_rate)
                
                # Transcribe
                result = await self.transcribe_chunk(temp_path, language)
                
                return result
                
        except Exception as e:
            logger.error(f"Streaming transcription failed: {e}")
            return None
        
        finally:
            # Clean up temporary file
            try:
                if 'temp_path' in locals() and os.path.exists(temp_path):
                    os.unlink(temp_path)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file: {e}")
    
    def check_audio_quality(self, audio_file_path: str) -> dict:
        """
        Check audio quality metrics for better transcription
        """
        try:
            # Load audio
            y, sr = librosa.load(audio_file_path, sr=16000)
            
            # Calculate quality metrics
            duration = len(y) / sr
            energy = float(np.mean(y ** 2))
            zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y)))
            
            # Determine if audio is likely to contain speech
            has_speech = energy > 0.001 and zero_crossing_rate > 0.01
            
            return {
                'duration': duration,
                'energy': energy,
                'zero_crossing_rate': zero_crossing_rate,
                'has_speech': has_speech,
                'quality_score': min(1.0, energy * 1000)  # Normalized quality score
            }
            
        except Exception as e:
            logger.error(f"Audio quality check failed: {e}")
            return {
                'duration': 0,
                'energy': 0,
                'zero_crossing_rate': 0,
                'has_speech': False,
                'quality_score': 0
            }
    
    async def transcribe_with_quality_check(self, audio_file_path: str) -> dict:
        """
        Transcribe with audio quality pre-check
        """
        try:
            # Check audio quality first
            quality_metrics = self.check_audio_quality(audio_file_path)
            
            if not quality_metrics['has_speech']:
                return {
                    'transcript': None,
                    'quality_metrics': quality_metrics,
                    'skipped_reason': 'No speech detected'
                }
            
            if quality_metrics['duration'] < 0.5:
                return {
                    'transcript': None,
                    'quality_metrics': quality_metrics,
                    'skipped_reason': 'Audio too short'
                }
            
            # Transcribe if quality checks pass
            transcript = await self.transcribe_chunk(audio_file_path)
            
            return {
                'transcript': transcript,
                'quality_metrics': quality_metrics,
                'skipped_reason': None
            }
            
        except Exception as e:
            logger.error(f"Transcription with quality check failed: {e}")
            return {
                'transcript': None,
                'quality_metrics': {},
                'error': str(e)
            }
    
    def get_status(self) -> dict:
        """Get service status"""
        return {
            'model_loaded': self.model_loaded,
            'model_type': 'whisper-base' if self.model_loaded else None,
            'executor_active': self.executor._threads is not None,
            'max_workers': self.executor._max_workers
        }
    
    def shutdown(self):
        """Shutdown the service and cleanup resources"""
        try:
            self.executor.shutdown(wait=True)
            logger.info("Speech-to-text service shutdown completed")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

# Global optimized speech-to-text instance
optimized_stt = OptimizedSpeechToText()

# Backward compatibility function
async def transcribe_audio(audio_file_path: str) -> str:
    """
    Backward compatible transcribe function
    """
    try:
        result = await optimized_stt.transcribe_with_quality_check(audio_file_path)
        
        if result.get('transcript'):
            return result['transcript']
        elif result.get('skipped_reason'):
            return f"Transcription skipped: {result['skipped_reason']}"
        elif result.get('error'):
            return f"Transcription failed: {result['error']}"
        else:
            return "Transcription failed: Unknown error"
            
    except Exception as e:
        logger.error(f"Transcribe audio failed: {e}")
        return f"Transcription failed: {str(e)}"
