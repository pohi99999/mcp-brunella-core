// LlamaViewModel.kt
package com.voiceassistant.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.voiceassistant.model.ChatMessage
import com.voiceassistant.repository.LlamaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LlamaViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = LlamaRepository()

    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val chatMessages = _chatMessages.asStateFlow()

    private val _currentResponse = MutableStateFlow("")
    val currentResponse = _currentResponse.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val _useStreaming = MutableStateFlow(false)
    val useStreaming = _useStreaming.asStateFlow()

    private val _selectedModel = MutableStateFlow("gemma3n:e2b")
    val selectedModel = _selectedModel.asStateFlow()

    fun sendPrompt(prompt: String) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _currentResponse.value = ""

                // Add user message to chat history
                val userMessage = ChatMessage(
                    content = prompt,
                    isUser = true,
                    model = _selectedModel.value
                )
                _chatMessages.value = _chatMessages.value + userMessage

                if (_useStreaming.value) {
                    // Create a placeholder assistant message for streaming
                    val assistantMessage = ChatMessage(
                        content = "",
                        isUser = false,
                        model = _selectedModel.value
                    )
                    _chatMessages.value = _chatMessages.value + assistantMessage

                    // Handle streaming with proper dispatcher
                    withContext(Dispatchers.IO) {
                        repository.getStreamingResponse(prompt, _selectedModel.value).collect { partialResponse ->
                            // Switch back to main thread to update UI
                            withContext(Dispatchers.Main) {
                                _currentResponse.value = partialResponse
                                // Update the last message in chat history with the current response
                                val updatedMessages = _chatMessages.value.toMutableList()
                                if (updatedMessages.isNotEmpty()) {
                                    updatedMessages[updatedMessages.size - 1] = updatedMessages.last().copy(content = partialResponse)
                                    _chatMessages.value = updatedMessages
                                }
                            }
                        }
                    }
                } else {
                    // Handle non-streaming with proper dispatcher
                    val result = withContext(Dispatchers.IO) {
                        repository.getResponse(prompt, _selectedModel.value, false)
                    }
                    _currentResponse.value = result

                    // Add assistant message to chat history
                    val assistantMessage = ChatMessage(
                        content = result,
                        isUser = false,
                        model = _selectedModel.value
                    )
                    _chatMessages.value = _chatMessages.value + assistantMessage
                }
            } catch (e: Exception) {
                val errorMessage = "Error: ${e.message}"
                _currentResponse.value = errorMessage

                // Add error message to chat history
                val errorChatMessage = ChatMessage(
                    content = errorMessage,
                    isUser = false,
                    model = _selectedModel.value
                )
                _chatMessages.value = _chatMessages.value + errorChatMessage
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearChat() {
        _chatMessages.value = emptyList()
        _currentResponse.value = ""
    }

    fun toggleStreaming() {
        _useStreaming.value = !_useStreaming.value
    }

    fun setModel(model: String) {
        _selectedModel.value = model
    }

    fun addSystemMessage(message: String) {
        viewModelScope.launch {
            val systemMessage = ChatMessage(
                content = message,
                isUser = false,
                model = "System"
            )
            _chatMessages.value = _chatMessages.value + systemMessage
        }
    }
}