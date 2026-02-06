# Speech-to-Text Setup Guide

This guide explains how to set up and use the offline Speech-to-Text feature in your Android app.

## Features Implemented

✅ **High-quality audio recording** (16kHz, mono, PCM 16-bit)  
✅ **Noise suppression** (when available)  
✅ **Real-time audio level monitoring**  
✅ **Offline speech recognition** using Vosk  
✅ **Beautiful Compose UI** with animations  
✅ **Automatic model loading** from assets  
✅ **Error handling** and user feedback  
✅ **Production-ready code** with proper architecture  

## Architecture

The implementation follows MVVM architecture with clean separation of concerns:

```
app/src/main/java/com/voiceassistant/
├── stt/
│   ├── AudioRecorder.kt          # High-quality audio recording
│   ├── VoskSpeechRecognizer.kt   # Offline speech recognition
│   └── SpeechToTextManager.kt    # Main coordinator
├── viewmodel/
│   └── SpeechToTextViewModel.kt  # ViewModel for UI
└── ui/screens/
    └── SpeechToTextScreen.kt     # Compose UI
```

## Setup Instructions

### 1. Dependencies Added

The following dependencies have been added to `app/build.gradle.kts`:

```kotlin
// Vosk for offline Speech-to-Text
implementation("org.vosk:vosk-android:0.3.32")

// Audio processing and visualization
implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
```

### 2. Permissions

The app already has the required permission in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### 3. Add Vosk Model

1. Download a Vosk model from: https://alphacephei.com/vosk/models
2. Extract it to: `app/src/main/assets/model/vosk-model-small-en-us-0.15/`
3. The model structure should look like:

```
assets/model/vosk-model-small-en-us-0.15/
├── am/
├── conf/
├── graph/
├── ivector/
├── rescore/
├── rnnlm/
└── README
```

### 4. Usage

The Speech-to-Text screen is accessible from the main screen via the "Speech to Text" button.

## How It Works

### Audio Recording Process

1. **Permission Check**: Verifies microphone permission
2. **Audio Initialization**: Sets up AudioRecord with optimal settings
3. **Noise Suppression**: Enables noise suppression if available
4. **Real-time Monitoring**: Tracks audio levels and duration
5. **WAV Export**: Saves audio as WAV file with proper headers

### Speech Recognition Process

1. **Model Loading**: Extracts and loads Vosk model from assets
2. **Audio Processing**: Reads WAV file and feeds to Vosk
3. **Transcription**: Parses JSON result to extract text
4. **Cleanup**: Removes temporary audio files

### UI Features

- **Status Indicators**: Shows ready/recording/processing states
- **Audio Visualization**: Real-time audio level bars
- **Recording Timer**: Shows recording duration
- **Result Display**: Shows transcribed text with clear option
- **Error Handling**: Displays errors with helpful messages

## Key Components

### AudioRecorder.kt

```kotlin
class AudioRecorder(private val context: Context) {
    // High-quality recording with noise suppression
    // Real-time audio level monitoring
    // WAV file export with proper headers
}
```

### VoskSpeechRecognizer.kt

```kotlin
class VoskSpeechRecognizer(private val context: Context) {
    // Offline speech recognition using Vosk
    // Model loading from assets
    // Audio file processing
}
```

### SpeechToTextManager.kt

```kotlin
class SpeechToTextManager(context: Context) {
    // Coordinates audio recording and transcription
    // State management and error handling
    // Clean API for UI interaction
}
```

### SpeechToTextViewModel.kt

```kotlin
class SpeechToTextViewModel(application: Application) : AndroidViewModel(application) {
    // Clean interface for UI
    // State management with StateFlow
    // Event handling
}
```

## Performance Optimizations

### Model Preloading

The Vosk model is loaded in a background thread during app initialization:

```kotlin
modelLoadingJob = CoroutineScope(Dispatchers.IO).launch {
    loadModelFromAssets(modelPath)
    _isModelLoaded.value = true
}
```

### Audio Processing

- Uses `AudioRecord` for precise control
- Implements noise suppression when available
- Optimized buffer sizes for 16kHz audio
- Efficient WAV file generation

### UI Responsiveness

- All heavy operations run on background threads
- State updates use StateFlow for reactive UI
- Smooth animations for audio visualization
- Non-blocking UI during processing

## Error Handling

The implementation includes comprehensive error handling:

- **Permission errors**: Clear messages about microphone access
- **Model loading errors**: Fallback messages and retry options
- **Recording errors**: Detailed error messages for debugging
- **Processing errors**: User-friendly error display

## Testing

To test the implementation:

1. **Build and run** the app
2. **Grant microphone permission** when prompted
3. **Navigate to Speech-to-Text** screen
4. **Tap the microphone button** to start recording
5. **Speak clearly** for 1-5 seconds
6. **Tap again to stop** or wait for auto-stop
7. **View transcription result**

## Troubleshooting

### Common Issues

1. **"Model not loaded" error**
   - Ensure Vosk model is properly extracted to assets
   - Check model directory structure

2. **"Microphone permission not granted"**
   - Grant microphone permission in app settings
   - Restart app after granting permission

3. **Poor transcription accuracy**
   - Use a larger Vosk model for better accuracy
   - Ensure quiet environment for recording
   - Speak clearly and at normal volume

4. **App crashes during recording**
   - Check device compatibility (min SDK 24)
   - Ensure sufficient storage space
   - Verify audio hardware is working

### Debug Information

Enable debug logging to troubleshoot issues:

```kotlin
Log.d("AudioRecorder", "Recording started")
Log.d("VoskSpeechRecognizer", "Model loaded successfully")
Log.d("SpeechToTextManager", "Transcription completed")
```

## Future Enhancements

Potential improvements for the Speech-to-Text feature:

1. **Multiple Language Support**: Add more Vosk models
2. **Real-time Streaming**: Process audio in real-time
3. **Custom Wake Words**: Integrate with wake word detection
4. **Audio Filters**: Add more audio processing options
5. **Cloud Fallback**: Add online STT as backup
6. **Voice Commands**: Integrate with command processing

## Conclusion

The Speech-to-Text implementation provides a complete, production-ready solution for offline speech recognition in Android. It features high-quality audio recording, efficient processing, beautiful UI, and comprehensive error handling.

The modular architecture makes it easy to extend and maintain, while the offline nature ensures privacy and reliability. 