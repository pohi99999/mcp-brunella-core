package com.voiceassistant.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.voiceassistant.stt.SpeechToTextManager
import com.voiceassistant.stt.SpeechToTextState
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel for Speech-to-Text functionality
 * 
 * Provides a clean interface for the UI to interact with the Speech-to-Text system
 */
class SpeechToTextViewModel(application: Application) : AndroidViewModel(application) {
    
    companion object {
        private const val TAG = "SpeechToTextViewModel"
    }
    
    // Speech-to-Text manager
    private val speechToTextManager = SpeechToTextManager(application)
    
    // State flows - directly from the manager
    val isReady: StateFlow<Boolean> = speechToTextManager.isReady
    val isRecording: StateFlow<Boolean> = speechToTextManager.isRecording
    val isListening: StateFlow<Boolean> = speechToTextManager.isListening
    val isProcessing: StateFlow<Boolean> = speechToTextManager.isProcessing
    val audioLevel: StateFlow<Float> = speechToTextManager.audioLevel
    val recordingDuration: StateFlow<Long> = speechToTextManager.recordingDuration
    val transcriptionResult: StateFlow<String> = speechToTextManager.transcriptionResult
    val error: StateFlow<String?> = speechToTextManager.error
    
    // Events
    private val _events = MutableSharedFlow<SpeechToTextEvent>()
    val events: SharedFlow<SpeechToTextEvent> = _events.asSharedFlow()
    
    /**
     * Start listening for speech
     */
    fun startListening() {
        if (!speechToTextManager.hasMicrophonePermission()) {
            viewModelScope.launch {
                _events.emit(SpeechToTextEvent.PermissionRequired)
            }
            return
        }
        
        speechToTextManager.startListening(
            onComplete = { transcription ->
                viewModelScope.launch {
                    _events.emit(SpeechToTextEvent.TranscriptionComplete(transcription))
                }
            },
            onError = { error ->
                viewModelScope.launch {
                    _events.emit(SpeechToTextEvent.Error(error))
                }
            }
        )
    }
    
    /**
     * Stop listening
     */
    fun stopListening() {
        speechToTextManager.stopListening()
    }
    
    /**
     * Cancel listening
     */
    fun cancelListening() {
        speechToTextManager.cancelListening()
    }
    
    /**
     * Toggle listening (start if not listening, stop if listening)
     */
    fun toggleListening() {
        if (isListening.value) {
            stopListening()
        } else {
            startListening()
        }
    }
    
    /**
     * Clear transcription results and errors
     */
    fun clearResults() {
        speechToTextManager.clearResults()
    }
    
    /**
     * Check if microphone permission is granted
     */
    fun hasMicrophonePermission(): Boolean {
        return speechToTextManager.hasMicrophonePermission()
    }
    
    /**
     * Get available languages
     */
    fun getAvailableLanguages(): List<String> {
        return speechToTextManager.getAvailableLanguages()
    }
    
    /**
     * Set language for recognition
     */
    fun setLanguage(languageCode: String) {
        speechToTextManager.setLanguage(languageCode)
    }
    
    /**
     * Get system status information
     */
    fun getStatusInfo(): String {
        return speechToTextManager.getStatusInfo()
    }
    
    /**
     * Format recording duration for display
     */
    fun formatDuration(durationMs: Long): String {
        val seconds = (durationMs / 1000).toInt()
        val milliseconds = (durationMs % 1000 / 10).toInt()
        return String.format("%d.%02d", seconds, milliseconds)
    }
    
    /**
     * Get audio level as percentage
     */
    fun getAudioLevelPercentage(): Int {
        return (audioLevel.value * 100).toInt()
    }
    
    /**
     * Check if the system is busy (recording or processing)
     */
    fun isBusy(): Boolean {
        return isRecording.value || isListening.value || isProcessing.value
    }
    
    /**
     * Check if there's an error
     */
    fun hasError(): Boolean {
        return error.value != null
    }
    
    /**
     * Check if there's a transcription result
     */
    fun hasResult(): Boolean {
        return transcriptionResult.value.isNotEmpty()
    }
    
    /**
     * Get the current state for debugging
     */
    fun getCurrentState(): String {
        return buildString {
            appendLine("SpeechToTextViewModel State:")
            appendLine("- Ready: ${isReady.value}")
            appendLine("- Recording: ${isRecording.value}")
            appendLine("- Listening: ${isListening.value}")
            appendLine("- Processing: ${isProcessing.value}")
            appendLine("- Has Result: ${hasResult()}")
            appendLine("- Has Error: ${hasError()}")
            appendLine("- Result: ${transcriptionResult.value}")
            appendLine("- Error: ${error.value}")
        }
    }
    
    override fun onCleared() {
        super.onCleared()
        speechToTextManager.release()
        Log.d(TAG, "SpeechToTextViewModel cleared")
    }
}

/**
 * Events that can be emitted by the Speech-to-Text system
 */
sealed class SpeechToTextEvent {
    data class TranscriptionComplete(val transcription: String) : SpeechToTextEvent()
    data class Error(val message: String) : SpeechToTextEvent()
    object PermissionRequired : SpeechToTextEvent()
    object RecordingStarted : SpeechToTextEvent()
    object RecordingStopped : SpeechToTextEvent()
    object ProcessingStarted : SpeechToTextEvent()
    object ProcessingComplete : SpeechToTextEvent()
} 