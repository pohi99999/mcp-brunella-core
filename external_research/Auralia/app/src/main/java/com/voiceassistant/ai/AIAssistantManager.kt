package com.voiceassistant.ai

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import com.voiceassistant.accessibility.VoiceAssistantAccessibilityService
import com.voiceassistant.model.*
import com.voiceassistant.repository.LlamaRepository
import kotlinx.coroutines.*
import java.util.*

class AIAssistantManager(
    private val context: Context,
    private val llamaRepository: LlamaRepository,
    private val textToSpeech: TextToSpeech
) {

    companion object {
        private const val TAG = "AIAssistantManager"
    }

    private val aiInterpreter = AICommandInterpreter(llamaRepository)
    private val managerScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var taskContinuationManager: TaskContinuationManager

    init {
        taskContinuationManager = TaskContinuationManager(context, llamaRepository, aiInterpreter)
    }
    interface AIAssistantCallback {
        fun onActionStarted(message: String)
        fun onActionCompleted(success: Boolean, message: String)
        fun onError(error: String)
    }

    private var callback: AIAssistantCallback? = null

    fun setCallback(callback: AIAssistantCallback) {
        this.callback = callback
    }

    fun processVoiceCommand(
        userCommand: String,
        onResult: ((Boolean, String) -> Unit)? = null
    ) {
        managerScope.launch {
            try {
                Log.d(TAG, "🎯 GENERIC Processing: $userCommand")

                speakText("Analyzing your request with AI...")
                callback?.onActionStarted("AI is thinking...")

                // AUCUN hardcoding - tout passe par l'IA
                val result = aiInterpreter.interpretCommand(userCommand)

                // Log pour voir ce que l'IA a décidé
                Log.d(TAG, "🧠 AI Decision: success=${result.success}")
                Log.d(TAG, "🧠 AI Message: ${result.message}")
                Log.d(TAG, "🧠 AI Actions: ${result.actions.size} actions")

                result.actions.forEachIndexed { index, action ->
                    Log.d(TAG, "🎬 Action ${index + 1}: $action")
                }

                if (!result.success) {
                    val errorMessage = "AI couldn't understand: ${result.message}"
                    speakText(errorMessage)
                    callback?.onError(errorMessage)
                    onResult?.invoke(false, errorMessage)
                    return@launch
                }

                // Vérifier le service d'accessibilité
                val accessibilityService = VoiceAssistantAccessibilityService.instance
                if (accessibilityService == null) {
                    val errorMessage = "Accessibility service not active"
                    speakText(errorMessage)
                    callback?.onError(errorMessage)
                    onResult?.invoke(false, errorMessage)
                    return@launch
                }

                // Dire ce que l'IA va faire
                speakText(result.message)
                delay(1500)

                if (result.actions.isNotEmpty()) {
                    val sequence = ActionSequence(
                        actions = result.actions,
                        description = result.message
                    )

                    Log.d(TAG, "🚀 Executing ${result.actions.size} AI-generated actions...")
                    val executionSuccess = accessibilityService.executeActionSequence(sequence)

                    val finalMessage = if (executionSuccess) {
                        "AI successfully executed all actions"
                    } else {
                        "Some AI actions failed during execution"
                    }

                    speakText(finalMessage)
                    callback?.onActionCompleted(executionSuccess, finalMessage)
                    onResult?.invoke(executionSuccess, finalMessage)
                } else {
                    val message = "AI generated no actions for this request"
                    speakText(message)
                    callback?.onActionCompleted(true, message)
                    onResult?.invoke(true, message)
                }

            } catch (e: Exception) {
                val errorMessage = "AI processing error: ${e.message}"
                Log.e(TAG, errorMessage, e)
                speakText("Sorry, AI encountered an error")
                callback?.onError(errorMessage)
                onResult?.invoke(false, errorMessage)
            }
        }
    }






    /**
     * Version détaillée qui retourne le JSON et les actions pour debug
     */
    /**
     * Version qui capture le VRAI JSON généré par Gemma3
     */
    fun processVoiceCommandWithDetails(
        userCommand: String,
        onResult: ((Boolean, String, String, List<String>) -> Unit)? = null
    ) {
        managerScope.launch {
            try {
                Log.d(TAG, "🔍 Processing with REAL JSON capture: $userCommand")

                speakText("AI is analyzing your request...")

                // Capturer la réponse BRUTE de Gemma3
                val rawGemmaResponse = llamaRepository.getResponse("""
You are an intelligent Android automation AI. Analyze this request and provide actions in JSON format:

USER REQUEST: "$userCommand"

Respond with JSON containing the actions needed to accomplish this task.
""")

                Log.d(TAG, "📥 RAW Gemma3 Response: $rawGemmaResponse")

                // Interpréter normalement
                val result = aiInterpreter.interpretCommand(userCommand)

                // Créer la description des actions
                val actionsDescription = result.actions.mapIndexed { index, action ->
                    when (action) {
                        is AccessibilityAction.Click -> "Click at (${action.x}, ${action.y})"
                        is AccessibilityAction.ClickOnText -> "Click on '${action.text}'"
                        is AccessibilityAction.Scroll -> "Scroll ${action.direction}"
                        is AccessibilityAction.Type -> "Type '${action.text}'"
                        is AccessibilityAction.Screenshot -> "Take screenshot"
                        is AccessibilityAction.GoBack -> "Go back"
                        is AccessibilityAction.GoHome -> "Go to home"
                        is AccessibilityAction.OpenNotifications -> "Open notifications"
                        is AccessibilityAction.Wait -> "Wait ${action.milliseconds}ms"
                        is AccessibilityAction.OpenApp -> "Open ${action.packageName}"
                        is AccessibilityAction.SetAlarm      ->
                            "Set alarm for ${action.hour}h${action.minute.toString().padStart(2,'0')}"
                        else                                 -> "Unknown action: $action"
                    }
                }

                Log.d(TAG, "📋 Generated ${actionsDescription.size} actions from AI")

                if (!result.success) {
                    val errorMessage = "AI couldn't process: ${result.message}"
                    speakText(errorMessage)
                    onResult?.invoke(false, errorMessage, rawGemmaResponse, listOf("Error: ${result.message}"))
                    return@launch
                }

                // Exécuter les actions
                val accessibilityService = VoiceAssistantAccessibilityService.instance
                if (accessibilityService == null) {
                    val errorMessage = "Accessibility service not active"
                    speakText(errorMessage)
                    onResult?.invoke(false, errorMessage, rawGemmaResponse, actionsDescription)
                    return@launch
                }

                speakText(result.message)
                delay(1000)

                if (result.actions.isNotEmpty()) {
                    val sequence = ActionSequence(
                        actions = result.actions,
                        description = result.message
                    )

                    val executionSuccess = accessibilityService.executeActionSequence(sequence)

                    val finalMessage = if (executionSuccess) {
                        "AI executed all ${result.actions.size} actions successfully"
                    } else {
                        "Some AI-generated actions failed"
                    }

                    speakText(finalMessage)
                    onResult?.invoke(executionSuccess, finalMessage, rawGemmaResponse, actionsDescription)
                } else {
                    val message = "AI generated no actions"
                    speakText(message)
                    onResult?.invoke(true, message, rawGemmaResponse, listOf("No actions generated"))
                }

            } catch (e: Exception) {
                val errorMessage = "AI processing error: ${e.message}"
                Log.e(TAG, errorMessage, e)
                speakText("AI encountered an error")
                onResult?.invoke(false, errorMessage, "Error getting AI response", listOf("Error: ${e.message}"))
            }
        }
    }
    /**
     * Capturer le JSON généré par l'IA (pour debug)
     */
    private suspend fun captureGeneratedJson(userCommand: String): String {
        return try {
            // Appeler directement le repository pour voir la réponse brute
            val prompt = """
You are an intelligent Android automation assistant...
USER REQUEST: "$userCommand"
RESPONSE:
"""
            llamaRepository.getResponse(prompt)
        } catch (e: Exception) {
            "Error capturing JSON: ${e.message}"
        }
    }

    /**
     * Décrire une action de manière lisible
     */
//    private fun describeAction(action: AccessibilityAction): String {
//        return when (action) {
//            is AccessibilityAction.Click -> "Click at coordinates (${action.x}, ${action.y})"
//            is AccessibilityAction.ClickOnText -> "Click on text '${action.text}'"
//            is AccessibilityAction.Scroll -> "Scroll ${action.direction}"
//            is AccessibilityAction.Type -> "Type '${action.text}'"
//            is AccessibilityAction.Screenshot -> "Take screenshot"
//            is AccessibilityAction.GoBack -> "Go back"
//            is AccessibilityAction.GoHome -> "Go to home screen"
//            is AccessibilityAction.OpenNotifications -> "Open notifications"
//            is AccessibilityAction.Wait -> "Wait ${action.milliseconds}ms"
//            is AccessibilityAction.OpenApp -> "Open app '${action.packageName}'"
//        }
//    }

    private fun speakText(text: String) {
        if (textToSpeech.isSpeaking.not()) {
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
        }
    }

    fun cleanup() {
        managerScope.cancel()
    }
}

data class SystemStatus(
    val accessibilityServiceConnected: Boolean,
    val ttsReady: Boolean,
    val aiModelReady: Boolean,
    val overallReady: Boolean
)