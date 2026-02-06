package com.voiceassistant.agent

import android.content.Context
import android.util.Log
import com.voiceassistant.agent.core.*
import com.voiceassistant.agent.parser.ActionParser
import com.voiceassistant.repository.LlamaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.*

/**
 * Main voice-controlled agent that orchestrates the automation loop
 */
class VoiceAgent(
    private val context: Context,
    private val modelUrl: String = "http://192.168.1.116:11434/",
    private val modelName: String = "gemma3n:e2b"
) {
    private val repository = LlamaRepository()
    private val parser = ActionParser()
    private var actionExecutor: ActionExecutor? = null

    // State management
    private val _isRunning = MutableStateFlow(false)
    val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

    private val _currentTask = MutableStateFlow<String?>(null)
    val currentTask: StateFlow<String?> = _currentTask.asStateFlow()

    private val _executedActions = MutableStateFlow<List<Action>>(emptyList())
    val executedActions: StateFlow<List<Action>> = _executedActions.asStateFlow()

    private val _lastResult = MutableStateFlow<ExecutionResult?>(null)
    val lastResult: StateFlow<ExecutionResult?> = _lastResult.asStateFlow()

    private val _screenText = MutableStateFlow<String?>(null)
    val screenText: StateFlow<String?> = _screenText.asStateFlow()

    /**
     * Set the action executor (accessibility or media projection)
     */
    fun setActionExecutor(executor: ActionExecutor) {
        this.actionExecutor = executor
    }

    /**
     * Start the automation loop with a user request
     */
    suspend fun startTask(userRequest: String) {
        if (_isRunning.value) {
            Log.w("VoiceAgent", "Agent is already running")
            return
        }

        if (actionExecutor == null) {
            Log.e("VoiceAgent", "No action executor set")
            return
        }

        if (!actionExecutor!!.isAvailable()) {
            Log.e("VoiceAgent", "Action executor is not available")
            return
        }

        _isRunning.value = true
        _currentTask.value = userRequest
        _executedActions.value = emptyList()
        _lastResult.value = null
        _screenText.value = null

        try {
            Log.d("VoiceAgent", "Starting task: $userRequest")
            awaitTaskCompletion(userRequest)
        } catch (e: Exception) {
            Log.e("VoiceAgent", "Task failed", e)
            _lastResult.value = ExecutionResult(false, "Task failed: ${e.message}", e)
        } finally {
            _isRunning.value = false
        }
    }

    /**
     * Stop the current task
     */
    fun stopTask() {
        _isRunning.value = false
        Log.d("VoiceAgent", "Task stopped by user")
    }

    /**
     * Main automation loop
     */
    private suspend fun awaitTaskCompletion(userRequest: String) {
        var iteration = 0
        val maxIterations = 20 // Prevent infinite loops

        while (_isRunning.value && iteration < maxIterations) {
            iteration++
            Log.d("VoiceAgent", "Iteration $iteration")

            // Take screenshot and extract text if needed
            if (_screenText.value == null || _lastResult.value?.screenshotTaken == true) {
                takeScreenshotAndOcr()
            }

            // Create prompt for the model
            val prompt = parser.createPrompt(
                userRequest = userRequest,
                screenText = _screenText.value,
                previousActions = _executedActions.value
            )

            // Get model response
            val modelResponse = getModelResponse(prompt)
            if (modelResponse == null) {
                Log.e("VoiceAgent", "Failed to get model response")
                break
            }

            // Execute the action
            val result = actionExecutor!!.executeAction(modelResponse.action)
            _lastResult.value = result

            // Add to executed actions
            _executedActions.value = _executedActions.value + modelResponse.action

            Log.d("VoiceAgent", "Executed action: ${modelResponse.action.description}")
            Log.d("VoiceAgent", "Result: ${result.message}")

            // Check if task is complete
            if (modelResponse.action is CompleteAction) {
                Log.d("VoiceAgent", "Task completed: ${modelResponse.action.message}")
                break
            }

            // Small delay between actions
            kotlinx.coroutines.delay(500)
        }

        if (iteration >= maxIterations) {
            Log.w("VoiceAgent", "Reached maximum iterations, stopping")
            _lastResult.value = ExecutionResult(false, "Reached maximum iterations")
        }
    }

    /**
     * Take screenshot and perform OCR
     */
    private suspend fun takeScreenshotAndOcr() {
        try {
            val screenshotResult = actionExecutor!!.takeScreenshot()
            if (screenshotResult.success && screenshotResult.imageData != null) {
                val ocrResult = actionExecutor!!.performOcr(screenshotResult.imageData)
                if (ocrResult.success) {
                    _screenText.value = ocrResult.text
                    Log.d("VoiceAgent", "OCR extracted text: ${ocrResult.text.take(100)}...")
                } else {
                    Log.w("VoiceAgent", "OCR failed: ${ocrResult.error}")
                    _screenText.value = ""
                }
            } else {
                Log.w("VoiceAgent", "Screenshot failed: ${screenshotResult.error}")
                _screenText.value = ""
            }
        } catch (e: Exception) {
            Log.e("VoiceAgent", "Screenshot/OCR failed", e)
            _screenText.value = ""
        }
    }

    /**
     * Get response from the language model
     */
    private suspend fun getModelResponse(prompt: String): ModelResponse? {
        return try {
            val response = repository.getResponse(prompt, modelName, false)
            Log.d("VoiceAgent", "Model response: $response")

            // Try to parse as JSON
            val modelResponse = parser.parseModelResponse(response)
            Log.d("VoiceAgent", "Parsed action: ${modelResponse.action.description}")
            modelResponse
        } catch (e: Exception) {
            Log.e("VoiceAgent", "Failed to get or parse model response", e)
            null
        }
    }

    /**
     * Get current status summary
     */
    fun getStatus(): String {
        return if (_isRunning.value) {
            "Running: ${_currentTask.value} (${_executedActions.value.size} actions executed)"
        } else {
            "Idle"
        }
    }

    /**
     * Reset the agent state
     */
    fun reset() {
        _isRunning.value = false
        _currentTask.value = null
        _executedActions.value = emptyList()
        _lastResult.value = null
        _screenText.value = null
    }
} 