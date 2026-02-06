package com.voiceassistant.stt

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.File

/**
 * Main Speech-to-Text manager that coordinates audio recording and transcription
 * 
 * Features:
 * - High-quality audio recording with noise suppression
 * - Speech recognition using Android's built-in SpeechRecognizer
 * - Real-time audio level monitoring
 * - Error handling and user feedback
 */
class SpeechToTextManager(context: Context) {
    
    companion object {
        private const val TAG = "SpeechToTextManager"
    }
    
    // Components
    private val audioRecorder = AudioRecorder(context)
    private val speechRecognizer = AndroidSpeechRecognizer(context)
    
    // State management
    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady.asStateFlow()
    
    val isRecording: StateFlow<Boolean> = audioRecorder.isRecording
    val audioLevel: StateFlow<Float> = audioRecorder.audioLevel
    val recordingDuration: StateFlow<Long> = audioRecorder.recordingDuration
    val isListening: StateFlow<Boolean> = speechRecognizer.isListening
    val isProcessing: StateFlow<Boolean> = speechRecognizer.isProcessing
    val transcriptionResult: StateFlow<String> = speechRecognizer.transcriptionResult
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    // Individual state flows are already exposed
    // The ViewModel can combine them as needed
    
    // Callbacks
    private var onTranscriptionComplete: ((String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    
    init {
        initialize()
    }
    
    /**
     * Initialize the Speech-to-Text system
     */
    private fun initialize() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Check if speech recognition is available
                if (speechRecognizer.isAvailable()) {
                    _isReady.value = true
                    Log.d(TAG, "Speech-to-Text system ready")
                } else {
                    _error.value = "Speech recognition not available on this device"
                    Log.e(TAG, "Speech recognition not available")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize Speech-to-Text system", e)
                _error.value = "Failed to initialize: ${e.message}"
            }
        }
    }
    
    /**
     * Start listening for speech
     */
    fun startListening(
        onComplete: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!audioRecorder.hasMicrophonePermission()) {
            val errorMsg = "Microphone permission not granted"
            _error.value = errorMsg
            onError(errorMsg)
            return
        }
        
        if (!_isReady.value) {
            val errorMsg = "Speech recognition not ready"
            _error.value = errorMsg
            onError(errorMsg)
            return
        }
        
        if (isListening.value) {
            Log.w(TAG, "Already listening")
            return
        }
        
        onTranscriptionComplete = onComplete
        this.onError = onError
        _error.value = null
        
        speechRecognizer.startListening(
            onComplete = { transcription ->
                Log.d(TAG, "Transcription completed: $transcription")
                onComplete(transcription)
            },
            onError = { errorMsg ->
                Log.e(TAG, "Transcription failed: $errorMsg")
                _error.value = errorMsg
                onError(errorMsg)
            }
        )
    }
    
    /**
     * Stop listening immediately
     */
    fun stopListening() {
        speechRecognizer.stopListening()
    }
    
    /**
     * Cancel listening
     */
    fun cancelListening() {
        speechRecognizer.cancelListening()
    }
    

    
    /**
     * Check if microphone permission is granted
     */
    fun hasMicrophonePermission(): Boolean {
        return audioRecorder.hasMicrophonePermission()
    }
    
    /**
     * Get current audio level (0.0 to 1.0)
     */
    fun getAudioLevel(): Float {
        return audioLevel.value
    }
    
    /**
     * Get recording duration in milliseconds
     */
    fun getRecordingDuration(): Long {
        return recordingDuration.value
    }
    
    /**
     * Get current transcription result
     */
    fun getTranscriptionResult(): String {
        return transcriptionResult.value
    }
    
    /**
     * Clear transcription result and errors
     */
    fun clearResults() {
        speechRecognizer.clearResults()
        _error.value = null
    }
    
    /**
     * Get available languages
     */
    fun getAvailableLanguages(): List<String> {
        return speechRecognizer.getAvailableLanguages()
    }
    
    /**
     * Set language for recognition
     */
    fun setLanguage(languageCode: String) {
        speechRecognizer.setLanguage(languageCode)
    }
    
    /**
     * Get system status information
     */
    fun getStatusInfo(): String {
        return buildString {
            appendLine("Speech-to-Text Status:")
            appendLine("- Ready: ${_isReady.value}")
            appendLine("- Recording: ${isRecording.value}")
            appendLine("- Listening: ${isListening.value}")
            appendLine("- Processing: ${isProcessing.value}")
            appendLine("- Speech recognition available: ${speechRecognizer.isAvailable()}")
            appendLine("- Audio level: ${String.format("%.2f", audioLevel.value)}")
            appendLine("- Recording duration: ${recordingDuration.value}ms")
        }
    }
    
    /**
     * Clean up resources
     */
    fun release() {
        audioRecorder.release()
        speechRecognizer.release()
        onTranscriptionComplete = null
        onError = null
    }
}

/**
 * State data class for Speech-to-Text system
 */
data class SpeechToTextState(
    val isReady: Boolean = false,
    val isRecording: Boolean = false,
    val isListening: Boolean = false,
    val isProcessing: Boolean = false,
    val transcriptionResult: String = "",
    val error: String? = null
) {
    val isBusy: Boolean = isRecording || isListening || isProcessing
    val hasError: Boolean = error != null
    val hasResult: Boolean = transcriptionResult.isNotEmpty()
} 