package com.voiceassistant.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.voiceassistant.network.OllamaApiClient
import com.voiceassistant.utils.ImageUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

data class ImageAnalysisState(
    val isLoading: Boolean = false,
    val isStreaming: Boolean = false,
    val result: String? = null,
    val error: String? = null,
    val selectedImageUri: Uri? = null
)

class ImageAnalysisViewModel : ViewModel() {
    
    private val apiClient = OllamaApiClient()
    
    private val _state = MutableStateFlow(ImageAnalysisState())
    val state: StateFlow<ImageAnalysisState> = _state.asStateFlow()
    
    fun setSelectedImage(uri: Uri) {
        _state.value = _state.value.copy(
            selectedImageUri = uri,
            result = null,
            error = null
        )
    }
    
    fun analyzeImage(context: android.content.Context, prompt: String = "Que vois-tu sur cette image ?") {
        val imageUri = _state.value.selectedImageUri ?: return
        
        viewModelScope.launch {
            _state.value = _state.value.copy(
                isLoading = true,
                error = null,
                result = null
            )
            
            try {
                // Convert image to base64
                val base64Image = ImageUtils.imageToBase64(context, imageUri)
                if (base64Image == null) {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = "Failed to process image"
                    )
                    return@launch
                }
                
                // Use streaming API
                _state.value = _state.value.copy(
                    isLoading = false,
                    isStreaming = true
                )
                
                apiClient.analyzeImageStream(base64Image, prompt).collect { streamingResponse ->
                    _state.value = _state.value.copy(
                        result = streamingResponse
                    )
                }
                
                // Streaming completed
                _state.value = _state.value.copy(
                    isStreaming = false
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Error: ${e.message}"
                )
            }
        }
    }
    
    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
    
    fun clearResult() {
        _state.value = _state.value.copy(result = null)
    }
    
    fun testConnection() {
        viewModelScope.launch {
            _state.value = _state.value.copy(
                isLoading = true,
                error = null
            )
            
            try {
                val result = apiClient.findWorkingServer()
                result.fold(
                    onSuccess = { workingUrl ->
                        _state.value = _state.value.copy(
                            isLoading = false,
                            error = "✅ Connexion réussie ! Serveur trouvé: $workingUrl"
                        )
                    },
                    onFailure = { exception ->
                        _state.value = _state.value.copy(
                            isLoading = false,
                            error = "❌ Erreur de connexion: ${exception.message}"
                        )
                    }
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "❌ Erreur: ${e.message}"
                )
            }
        }
    }
} 