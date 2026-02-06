package com.voiceassistant.service

import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineException
import ai.picovoice.porcupine.PorcupineManager
import ai.picovoice.porcupine.PorcupineManagerCallback
import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import com.voiceassistant.MainActivity
import com.voiceassistant.R
import com.voiceassistant.commands.CommandProcessor
import java.util.*
import android.os.Bundle
import android.util.Log


class VoiceAssistantService : Service(), TextToSpeech.OnInitListener, PorcupineManagerCallback {
    
    private lateinit var porcupineManager: PorcupineManager
    private lateinit var speechRecognizer: SpeechRecognizer
    private lateinit var textToSpeech: TextToSpeech
    private lateinit var commandProcessor: CommandProcessor
    
    private var isListeningForCommand = false
    
    companion object {
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "VoiceAssistantChannel"
        private const val PORCUPINE_ACCESS_KEY = "YOUR_PORCUPINE_ACCESS_KEY" // Replace with your key
    }
    
    override fun onCreate() {
        super.onCreate()
        
        textToSpeech = TextToSpeech(this, this)
        commandProcessor = CommandProcessor(this, textToSpeech)
        
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        
        initializePorcupine()
        initializeSpeechRecognizer()
    }
    
    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Voice Assistant Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Voice assistant running in background"
            setSound(null, null)
        }
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.createNotificationChannel(channel)
    }
    
    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Voice Assistant Active")
            .setContentText("Say 'Hey Gemma' to activate")
            .setSmallIcon(R.drawable.ic_mic)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
    
    private fun initializePorcupine() {
        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey(PORCUPINE_ACCESS_KEY)
                .setKeywordPath("path/to/hey_gemma.ppn") // Custom wake word file
                .setSensitivity(0.5f)
                .build(applicationContext, this)
            
            porcupineManager.start()
        } catch (e: PorcupineException) {
            // Fallback to basic wake word detection if Porcupine fails
            speakText("Wake word detection initialized with basic mode")
        }
    }
    
    private fun initializeSpeechRecognizer() {
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                // Ready to listen
                Log.d("SpeechRecognizer", "Ready to listen")
            }
            
            override fun onBeginningOfSpeech() {
                // User started speaking
                Log.d("SpeechRecognizer", "Ready to listen")
            }
            
            override fun onRmsChanged(rmsdB: Float) {
                // Audio level changed
                Log.d("SpeechRecognizer", "Ready to listen")
            }
            
            override fun onBufferReceived(buffer: ByteArray?) {
                // Audio buffer received
                Log.d("SpeechRecognizer", "Ready to listen")
            }
            
            override fun onEndOfSpeech() {
                // User stopped speaking
                Log.d("SpeechRecognizer", "Ready to listen")
            }
            
            override fun onError(error: Int) {
                isListeningForCommand = false
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH -> {
                        speakText("I didn't understand that. Please try again.")
                    }
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                        speakText("I didn't hear anything. Please try again.")
                    }
                    else -> {
                        speakText("There was an error processing your command.")
                    }
                }
            }
            
            override fun onResults(results: Bundle?) {
                isListeningForCommand = false
                results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.let { matches ->
                    if (matches.isNotEmpty()) {
                        val command = matches[0]
                        commandProcessor.processCommand(command)
                    }
                }
            }
            
            override fun onPartialResults(partialResults: Bundle?) {
                // Partial results received
            }
            
            override fun onEvent(eventType: Int, params: Bundle?) {
                // Speech recognition event
            }
        })
    }

    override fun invoke(keywordIndex: Int) {
        if (!isListeningForCommand) {
            isListeningForCommand = true
            speakText("Yes, I'm listening")
            startListeningForCommand()
        }
    }
    
    private fun startListeningForCommand() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000)
        }
        
        speechRecognizer.startListening(intent)
    }
    
    private fun speakText(text: String) {
        if (::textToSpeech.isInitialized) {
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
        }
    }
    
    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech.language = Locale.getDefault()
            // Configure for accessibility
            textToSpeech.setSpeechRate(0.9f) // Slightly slower for clarity
            textToSpeech.setPitch(1.0f)
        }
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        
        try {
            porcupineManager.stop()
            porcupineManager.delete()
        } catch (e: Exception) {
            // Handle cleanup error
        }
        
        speechRecognizer.destroy()
        
        if (::textToSpeech.isInitialized) {
            textToSpeech.stop()
            textToSpeech.shutdown()
        }
    }
}
