# Ollama Integration Setup Guide

## Prerequisites

1. **Install Ollama** on your computer:
   - Visit [ollama.ai](https://ollama.ai) and download the installer
   - Follow the installation instructions for your operating system

2. **Pull the Gemma 3N E2B model**:
   ```bash
   ollama pull gemma3n:e2b
   ```

3. **Start Ollama server**:
   ```bash
   ollama serve
   ```

## Android App Setup

The app is configured to connect to Ollama running on your computer at `http://10.0.2.2:11434/` (Android emulator's localhost).

### Features Added

1. **LlamaScreen**: A chat interface to interact with Gemma 3N E2B
2. **Network Configuration**: Proper permissions and security config for local development
3. **Error Handling**: Comprehensive error messages for common issues
4. **Loading States**: Visual feedback during API calls

### How to Use

1. Start your Android app
2. Navigate to the main screen
3. Tap the "Gemma Chat" button (microphone icon)
4. Enter your prompt and tap "Send to Gemma"
5. Wait for the response from the model

### Troubleshooting

**Common Issues:**

1. **"Cannot connect to Ollama server"**
   - Make sure Ollama is running: `ollama serve`
   - Check if the model is downloaded: `ollama list`

2. **"Request timed out"**
   - The model might be taking too long to respond
   - Try a shorter prompt
   - Check your computer's performance

3. **Network errors**
   - Ensure your Android emulator can reach your computer
   - Check firewall settings
   - Verify Ollama is running on port 11434

### Testing

To test the integration:

1. Start Ollama: `ollama serve`
2. Pull the model: `ollama pull gemma3n:e2b`
3. Run your Android app
4. Navigate to Gemma Chat
5. Try a simple prompt like "Hello, how are you?"

### Files Modified

- `app/src/main/java/com/voiceassistant/model/LlamaRequest.kt` - Fixed data class structure
- `app/src/main/java/com/voiceassistant/model/LlamaResponse.kt` - Fixed data class structure
- `app/src/main/java/com/voiceassistant/network/LlamaApi.kt` - API interface
- `app/src/main/java/com/voiceassistant/repository/LlamaRepository.kt` - Network layer with error handling
- `app/src/main/java/com/voiceassistant/viewmodel/LlamaViewModel.kt` - ViewModel with loading states
- `app/src/main/java/com/voiceassistant/ui/screens/LlamaScreen.kt` - UI for chat interface
- `app/src/main/AndroidManifest.xml` - Added internet permissions
- `app/src/main/res/xml/network_security_config.xml` - Network security configuration
- `app/src/main/java/com/voiceassistant/MainActivity.kt` - Added navigation to LlamaScreen
- `app/src/main/java/com/voiceassistant/ui/screens/MainAssistantScreen.kt` - Added Gemma Chat button 