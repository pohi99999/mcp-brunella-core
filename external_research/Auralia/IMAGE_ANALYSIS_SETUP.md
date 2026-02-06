# Image Analysis Setup with Ollama

This document explains how to set up and use the image analysis feature in the Auralia Android app.

## Prerequisites

1. **Ollama Server**: Make sure you have Ollama running locally with the `llava` model installed.
2. **Network Access**: The Android app needs to be able to reach your Ollama server at `http://10.0.2.2:11434`.

## Setup Instructions

### 1. Install Ollama and llava model

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the llava model
ollama pull llava

# Start Ollama server
ollama serve
```

### 2. Verify Ollama is running

Test that your Ollama server is accessible:

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llava",
  "prompt": "What do you see?",
  "images": ["<base64_image_string>"]
}'
```

### 3. Android App Configuration

The app is already configured to connect to `http://10.0.2.2:11434` which maps to `localhost:11434` when running on an Android emulator.

## Usage

### 1. Launch the App

1. Open the Auralia app
2. Navigate to the main screen
3. Tap on the "Image Analysis" button

### 2. Select or Take a Photo

- **Select Image**: Tap "Select Image" to choose an existing photo from your gallery
- **Take Photo**: Tap "Take Photo" to capture a new image using the camera

### 3. Analyze the Image

1. After selecting an image, tap "Analyze Image"
2. You can customize the prompt (default: "Que vois-tu sur cette image ?")
3. The app will send the image to Ollama and display the analysis result

## Features

- **Image Compression**: Images are automatically resized to 1024px max dimension to reduce API payload size
- **Base64 Encoding**: Images are converted to base64 format as required by the Ollama API
- **Error Handling**: Comprehensive error handling for network issues and image processing
- **Custom Prompts**: Users can customize the analysis prompt
- **Loading States**: Visual feedback during image processing and API calls

## Technical Details

### API Endpoint
- **URL**: `http://10.0.2.2:11434/api/generate`
- **Method**: POST
- **Content-Type**: application/json

### Request Format
```json
{
  "model": "llava",
  "prompt": "Que vois-tu sur cette image ?",
  "images": ["<base64_image_string>"]
}
```

### Response Format
```json
{
  "response": "Analysis result text"
}
```

### Permissions Required
- `CAMERA`: For taking photos
- `READ_EXTERNAL_STORAGE`: For accessing gallery images
- `READ_MEDIA_IMAGES`: For Android 13+ gallery access
- `INTERNET`: For API communication

## Troubleshooting

### Common Issues

1. **Connection Refused**: Make sure Ollama is running on port 11434
2. **Model Not Found**: Ensure the `llava` model is installed (`ollama pull llava`)
3. **Permission Denied**: Grant camera and storage permissions in app settings
4. **Large Image Errors**: Images are automatically compressed, but very large images might still cause issues

### Debug Logs

Check the Android logs for debugging information:
```bash
adb logcat | grep -E "(OllamaApiClient|ImageUtils|ImageAnalysis)"
```

## Architecture

The image analysis feature follows MVVM architecture:

- **View**: `ImageAnalysisScreen.kt` - UI components
- **ViewModel**: `ImageAnalysisViewModel.kt` - Business logic and state management
- **Model**: `OllamaRequest.kt`, `OllamaResponse.kt` - Data models
- **Network**: `OllamaApiClient.kt` - API communication
- **Utils**: `ImageUtils.kt` - Image processing utilities

## Dependencies

- **Retrofit**: HTTP client for API calls
- **Coil**: Image loading and caching
- **Kotlin Coroutines**: Asynchronous operations
- **Jetpack Compose**: Modern UI framework 