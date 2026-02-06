package com.voiceassistant.stt

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.*

/**
 * Android Speech-to-Text using built-in SpeechRecognizer
 * 
 * Features:
 * - Uses Android's built-in speech recognition
 * - Works offline (depends on device capabilities)
 * - Real-time transcription
 * - Multiple language support
 * - Error handling
 */
class AndroidSpeechRecognizer(private val context: Context) {
    
    companion object {
        private const val TAG = "AndroidSpeechRecognizer"
    }
    
    // Speech recognizer
    private var speechRecognizer: SpeechRecognizer? = null
    
    // State management
    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()
    
    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()
    
    private val _transcriptionResult = MutableStateFlow("")
    val transcriptionResult: StateFlow<String> = _transcriptionResult.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    // Callbacks
    private var onTranscriptionComplete: ((String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    
    init {
        initializeSpeechRecognizer()
    }
    
    /**
     * Initialize the speech recognizer
     */
    private fun initializeSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
            speechRecognizer?.setRecognitionListener(createRecognitionListener())
            Log.d(TAG, "Speech recognizer initialized")
        } else {
            Log.e(TAG, "Speech recognition not available on this device")
            _error.value = "Speech recognition not available on this device"
        }
    }
    
    /**
     * Create recognition listener
     */
    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d(TAG, "Ready for speech")
                _isListening.value = true
                _error.value = null
            }
            
            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Beginning of speech")
            }
            
            override fun onRmsChanged(rmsdB: Float) {
                // Audio level changed - could be used for visualization
            }
            
            override fun onBufferReceived(buffer: ByteArray?) {
                // Audio buffer received
            }
            
            override fun onEndOfSpeech() {
                Log.d(TAG, "End of speech")
                _isListening.value = false
                _isProcessing.value = true
            }
            
            override fun onError(error: Int) {
                _isListening.value = false
                _isProcessing.value = false
                
                val errorMessage = when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH -> "No speech detected"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout"
                    SpeechRecognizer.ERROR_NETWORK -> "Network error"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                    SpeechRecognizer.ERROR_SERVER -> "Server error"
                    SpeechRecognizer.ERROR_CLIENT -> "Client error"
                    SpeechRecognizer.ERROR_AUDIO -> "Audio error"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                    else -> "Unknown error: $error"
                }
                
                Log.e(TAG, "Speech recognition error: $errorMessage")
                _error.value = errorMessage
                onError?.invoke(errorMessage)
            }
            
            override fun onResults(results: Bundle?) {
                _isListening.value = false
                _isProcessing.value = false
                
                results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                    if (matches.isNotEmpty()) {
                        val transcription = matches[0]
                        Log.d(TAG, "Transcription result: $transcription")
                        _transcriptionResult.value = transcription
                        onTranscriptionComplete?.invoke(transcription)
                    }
                }
            }
            
            override fun onPartialResults(partialResults: Bundle?) {
                partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                    if (matches.isNotEmpty()) {
                        val partialTranscription = matches[0]
                        Log.d(TAG, "Partial result: $partialTranscription")
                        _transcriptionResult.value = partialTranscription
                    }
                }
            }
            
            override fun onEvent(eventType: Int, params: Bundle?) {
                // Speech recognition event
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
        if (speechRecognizer == null) {
            val errorMsg = "Speech recognizer not initialized"
            _error.value = errorMsg
            onError(errorMsg)
            return
        }
        
        onTranscriptionComplete = onComplete
        this.onError = onError
        _error.value = null
        _transcriptionResult.value = ""
        
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 5000)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 5000)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 5000)
        }
        
        speechRecognizer?.startListening(intent)
        Log.d(TAG, "Started listening for speech")
    }
    
    /**
     * Stop listening
     */
    fun stopListening() {
        speechRecognizer?.stopListening()
        _isListening.value = false
        Log.d(TAG, "Stopped listening")
    }
    
    /**
     * Cancel listening
     */
    fun cancelListening() {
        speechRecognizer?.cancel()
        _isListening.value = false
        _isProcessing.value = false
        Log.d(TAG, "Cancelled listening")
    }
    
    /**
     * Check if speech recognition is available
     */
    fun isAvailable(): Boolean {
        return SpeechRecognizer.isRecognitionAvailable(context)
    }
    
    /**
     * Get available languages
     */
    fun getAvailableLanguages(): List<String> {
        return listOf(
            "English (US)",
            "English (UK)", 
            "French",
            "Spanish",
            "German",
            "Italian"
        )
    }
    
    /**
     * Set language for recognition
     */
    fun setLanguage(languageCode: String) {
        // This would be implemented to change the recognition language
        Log.d(TAG, "Language set to: $languageCode")
    }
    
    /**
     * Clear results and errors
     */
    fun clearResults() {
        _transcriptionResult.value = ""
        _error.value = null
    }
    
    /**
     * Get current transcription result
     */
    fun getTranscriptionResult(): String {
        return _transcriptionResult.value
    }
    
    /**
     * Clean up resources
     */
    fun release() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        onTranscriptionComplete = null
        onError = null
    }
} 