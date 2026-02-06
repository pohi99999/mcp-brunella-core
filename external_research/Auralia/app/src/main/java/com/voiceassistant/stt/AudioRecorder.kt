package com.voiceassistant.stt

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.text.SimpleDateFormat
import java.util.*

/**
 * High-quality audio recorder for offline Speech-to-Text processing
 * 
 * Features:
 * - 16kHz mono PCM recording
 * - Noise suppression (when available)
 * - Real-time audio level monitoring
 * - Automatic recording timeout
 * - WAV file output
 */
class AudioRecorder(private val context: Context) {
    
    companion object {
        private const val TAG = "AudioRecorder"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_FACTOR = 2
        private const val MAX_RECORDING_DURATION_MS = 5000L // 5 seconds
        private const val AUDIO_LEVEL_UPDATE_INTERVAL_MS = 100L
    }
    
    // Audio recording state
    private var audioRecord: AudioRecord? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var recordingJob: Job? = null
    private var audioLevelJob: Job? = null
    
    // Audio processing
    private val bufferSize: Int = AudioRecord.getMinBufferSize(
        SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT
    ) * BUFFER_SIZE_FACTOR
    
    private val audioBuffer = ByteArray(bufferSize)
    private val audioData = mutableListOf<Byte>()
    
    // State management
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()
    
    private val _audioLevel = MutableStateFlow(0f)
    val audioLevel: StateFlow<Float> = _audioLevel.asStateFlow()
    
    private val _recordingDuration = MutableStateFlow(0L)
    val recordingDuration: StateFlow<Long> = _recordingDuration.asStateFlow()
    
    private val _recordingError = MutableStateFlow<String?>(null)
    val recordingError: StateFlow<String?> = _recordingError.asStateFlow()
    
    // Callbacks
    private var onRecordingComplete: ((File) -> Unit)? = null
    private var onRecordingError: ((String) -> Unit)? = null
    
    /**
     * Check if microphone permission is granted
     */
    fun hasMicrophonePermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            context, 
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    /**
     * Start recording audio with high quality settings
     */
    fun startRecording(
        onComplete: (File) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!hasMicrophonePermission()) {
            onError("Microphone permission not granted")
            return
        }
        
        if (_isRecording.value) {
            Log.w(TAG, "Recording already in progress")
            return
        }
        
        onRecordingComplete = onComplete
        onRecordingError = onError
        
        recordingJob = CoroutineScope(Dispatchers.IO).launch {
            try {
                initializeAudioRecord()
                startAudioLevelMonitoring()
                recordAudio()
            } catch (e: Exception) {
                Log.e(TAG, "Error during recording", e)
                _recordingError.value = e.message ?: "Unknown recording error"
                onError(e.message ?: "Unknown recording error")
                stopRecording()
            }
        }
    }
    
    /**
     * Stop recording and save audio file
     */
    fun stopRecording() {
        if (!_isRecording.value) return
        
        recordingJob?.cancel()
        audioLevelJob?.cancel()
        
        try {
            noiseSuppressor?.release()
            audioRecord?.stop()
            audioRecord?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
        } finally {
            audioRecord = null
            noiseSuppressor = null
            _isRecording.value = false
            _audioLevel.value = 0f
            _recordingDuration.value = 0L
        }
    }
    
    /**
     * Initialize AudioRecord with optimal settings
     */
    private fun initializeAudioRecord() {
        // Check permission before creating AudioRecord
        if (!hasMicrophonePermission()) {
            throw SecurityException("Microphone permission not granted")
        }
        
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT,
            bufferSize
        ).apply {
            // Enable noise suppression if available
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                noiseSuppressor = NoiseSuppressor.create(audioSessionId)
                noiseSuppressor?.enabled = true
                Log.d(TAG, "Noise suppression ${if (noiseSuppressor?.enabled == true) "enabled" else "not available"}")
            }
        }
        
        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            throw IllegalStateException("Failed to initialize AudioRecord")
        }
        
        audioData.clear()
        _isRecording.value = true
        _recordingError.value = null
        Log.d(TAG, "Audio recording initialized successfully")
    }
    
    /**
     * Start monitoring audio levels in real-time
     */
    private fun startAudioLevelMonitoring() {
        audioLevelJob = CoroutineScope(Dispatchers.IO).launch {
            while (_isRecording.value) {
                val level = calculateAudioLevel()
                _audioLevel.value = level
                delay(AUDIO_LEVEL_UPDATE_INTERVAL_MS)
            }
        }
    }
    
    /**
     * Main recording loop
     */
    private suspend fun recordAudio() {
        audioRecord?.startRecording()
        Log.d(TAG, "Started recording audio")
        
        val startTime = System.currentTimeMillis()
        
        while (_isRecording.value) {
            val bytesRead = audioRecord?.read(audioBuffer, 0, bufferSize) ?: 0
            
            if (bytesRead > 0) {
                audioData.addAll(audioBuffer.take(bytesRead))
                _recordingDuration.value = System.currentTimeMillis() - startTime
                
                // Check for maximum recording duration
                if (_recordingDuration.value >= MAX_RECORDING_DURATION_MS) {
                    Log.d(TAG, "Maximum recording duration reached")
                    break
                }
            } else if (bytesRead == AudioRecord.ERROR_INVALID_OPERATION) {
                throw IllegalStateException("Invalid audio recording operation")
            }
        }
        
        // Save the recorded audio
        val audioFile = saveAudioToFile()
        onRecordingComplete?.invoke(audioFile)
    }
    
    /**
     * Calculate current audio level (RMS)
     */
    private fun calculateAudioLevel(): Float {
        if (audioData.isEmpty()) return 0f
        
        val recentData = audioData.takeLast(bufferSize)
        val samples = ByteBuffer.wrap(recentData.toByteArray())
            .order(ByteOrder.LITTLE_ENDIAN)
            .asShortBuffer()
        
        var sum = 0.0
        for (i in 0 until samples.remaining()) {
            val sample = samples.get(i).toDouble()
            sum += sample * sample
        }
        
        val rms = Math.sqrt(sum / samples.remaining())
        return (rms / Short.MAX_VALUE).toFloat().coerceIn(0f, 1f)
    }
    
    /**
     * Save recorded audio as WAV file
     */
    private fun saveAudioToFile(): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val fileName = "recording_$timestamp.wav"
        val audioFile = File(context.cacheDir, fileName)
        
        try {
            FileOutputStream(audioFile).use { output ->
                // Write WAV header
                writeWavHeader(output, audioData.size)
                
                // Write audio data
                output.write(audioData.toByteArray())
                output.flush()
            }
            
            Log.d(TAG, "Audio saved to: ${audioFile.absolutePath}")
            return audioFile
        } catch (e: IOException) {
            Log.e(TAG, "Error saving audio file", e)
            throw RuntimeException("Failed to save audio file", e)
        }
    }
    
    /**
     * Write WAV file header
     */
    private fun writeWavHeader(output: FileOutputStream, dataSize: Int) {
        val header = ByteArray(44)
        var offset = 0
        
        // RIFF header
        "RIFF".toByteArray().copyInto(header, offset)
        offset += 4
        
        // File size (data size + 36)
        val fileSize = dataSize + 36
        header[offset++] = (fileSize and 0xFF).toByte()
        header[offset++] = ((fileSize shr 8) and 0xFF).toByte()
        header[offset++] = ((fileSize shr 16) and 0xFF).toByte()
        header[offset++] = ((fileSize shr 24) and 0xFF).toByte()
        
        // WAVE identifier
        "WAVE".toByteArray().copyInto(header, offset)
        offset += 4
        
        // fmt chunk
        "fmt ".toByteArray().copyInto(header, offset)
        offset += 4
        
        // Chunk size (16 for PCM)
        header[offset++] = 16
        header[offset++] = 0
        header[offset++] = 0
        header[offset++] = 0
        
        // Audio format (1 for PCM)
        header[offset++] = 1
        header[offset++] = 0
        
        // Number of channels (1 for mono)
        header[offset++] = 1
        header[offset++] = 0
        
        // Sample rate
        header[offset++] = (SAMPLE_RATE and 0xFF).toByte()
        header[offset++] = ((SAMPLE_RATE shr 8) and 0xFF).toByte()
        header[offset++] = ((SAMPLE_RATE shr 16) and 0xFF).toByte()
        header[offset++] = ((SAMPLE_RATE shr 24) and 0xFF).toByte()
        
        // Byte rate (sample rate * channels * bits per sample / 8)
        val byteRate = SAMPLE_RATE * 1 * 16 / 8
        header[offset++] = (byteRate and 0xFF).toByte()
        header[offset++] = ((byteRate shr 8) and 0xFF).toByte()
        header[offset++] = ((byteRate shr 16) and 0xFF).toByte()
        header[offset++] = ((byteRate shr 24) and 0xFF).toByte()
        
        // Block align (channels * bits per sample / 8)
        header[offset++] = 2
        header[offset++] = 0
        
        // Bits per sample
        header[offset++] = 16
        header[offset++] = 0
        
        // data chunk
        "data".toByteArray().copyInto(header, offset)
        offset += 4
        
        // Data size
        header[offset++] = (dataSize and 0xFF).toByte()
        header[offset++] = ((dataSize shr 8) and 0xFF).toByte()
        header[offset++] = ((dataSize shr 16) and 0xFF).toByte()
        header[offset++] = ((dataSize shr 24) and 0xFF).toByte()
        
        output.write(header)
    }
    
    /**
     * Clean up resources
     */
    fun release() {
        stopRecording()
        recordingJob?.cancel()
        audioLevelJob?.cancel()
    }
} 