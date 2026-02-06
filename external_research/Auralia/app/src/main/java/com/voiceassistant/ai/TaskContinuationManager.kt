// TaskContinuationManager.kt - NOUVEAU FICHIER À CRÉER
package com.voiceassistant.ai

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.voiceassistant.model.*
import com.voiceassistant.repository.LlamaRepository
import kotlinx.coroutines.*

class TaskContinuationManager(
    private val context: Context,
    private val llamaRepository: LlamaRepository,
    private val aiInterpreter: AICommandInterpreter
) {

    companion object {
        private const val TAG = "TaskContinuation"
        private const val PREFS_NAME = "task_context"
        private const val KEY_CURRENT_TASK = "current_task"
        private const val KEY_TASK_STEP = "task_step"
        private const val KEY_ORIGINAL_COMMAND = "original_command"
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Continuer une tâche après une capture d'écran
     */
    suspend fun continueTaskAfterScreenshot(screenDescription: String = ""): CommandResult? {
        val currentTask = prefs.getString(KEY_CURRENT_TASK, null)
        val originalCommand = prefs.getString(KEY_ORIGINAL_COMMAND, null)
        val currentStep = prefs.getInt(KEY_TASK_STEP, 0)

        if (currentTask == null || originalCommand == null) {
            Log.d(TAG, "No ongoing task to continue")
            return null
        }

        Log.d(TAG, "Continuing task: $currentTask (step $currentStep)")

        return when (currentTask) {
            "set_alarm" -> continueAlarmTask(originalCommand, currentStep, screenDescription)
            "send_message" -> continueMessageTask(originalCommand, currentStep, screenDescription)
            "check_weather" -> continueWeatherTask(originalCommand, currentStep, screenDescription)
            else -> {
                Log.w(TAG, "Unknown task type: $currentTask")
                clearTaskContext()
                null
            }
        }
    }

    private suspend fun continueAlarmTask(originalCommand: String, step: Int, screenDescription: String): CommandResult {
        return when (step) {
            0 -> { // Juste ouvert l'app horloge
                updateTaskStep(1)

                // Analyser l'écran de l'app horloge
                val prompt = """
Analyze this clock app screen and provide next actions to set an alarm.

Original command: "$originalCommand"
Current screen: Clock app just opened
Screen analysis: $screenDescription

What should I do next? Look for:
1. "Alarm" tab or button
2. "+" or "Add alarm" button  
3. Time setting interface

Provide JSON with next actions to navigate to alarm creation.
"""

                val response = llamaRepository.getResponse(prompt)
                parseNextStepResponse(response)
            }

            1 -> { // Dans l'interface d'alarme
                updateTaskStep(2)

                val prompt = """
I'm in the alarm interface. Original command: "$originalCommand"
Current screen: $screenDescription

Extract the time from the original command and provide actions to:
1. Set the hour (look for hour selector, time picker)
2. Set the minutes if specified
3. Set AM/PM if needed
4. Look for save/confirm button

Provide specific click actions based on what's visible.
"""

                val response = llamaRepository.getResponse(prompt)
                parseNextStepResponse(response)
            }

            2 -> { // Finalisation
                clearTaskContext()
                CommandResult(
                    success = true,
                    message = "Alarm setup completed",
                    actions = listOf(
                        AccessibilityAction.ClickOnText("Save"),
                        AccessibilityAction.Wait(1000),
                        AccessibilityAction.ClickOnText("OK")
                    )
                )
            }

            else -> {
                clearTaskContext()
                CommandResult(success = false, message = "Unknown alarm step: $step")
            }
        }
    }

    private suspend fun continueMessageTask(originalCommand: String, step: Int, screenDescription: String): CommandResult {
        // Implémentation similaire pour les messages
        return when (step) {
            0 -> {
                updateTaskStep(1)
                CommandResult(
                    success = true,
                    message = "Opening messaging app",
                    actions = listOf(
                        AccessibilityAction.OpenApp("com.google.android.apps.messaging"),
                        AccessibilityAction.Wait(2000),
                        AccessibilityAction.Screenshot
                    )
                )
            }
            else -> {
                clearTaskContext()
                CommandResult(success = false, message = "Message task not fully implemented")
            }
        }
    }

    private suspend fun continueWeatherTask(originalCommand: String, step: Int, screenDescription: String): CommandResult {
        // Implémentation pour la météo
        clearTaskContext()
        return CommandResult(
            success = true,
            message = "Weather check completed",
            actions = listOf(AccessibilityAction.GoBack)
        )
    }

    private suspend fun parseNextStepResponse(response: String): CommandResult {
        return try {
            // Utiliser l'interpréteur existant pour parser la réponse
            val jsonStart = response.indexOf('{')
            val jsonEnd = response.lastIndexOf('}') + 1

            if (jsonStart != -1 && jsonEnd > jsonStart) {
                val jsonString = response.substring(jsonStart, jsonEnd)
                // Parse avec votre logique existante
                CommandResult(
                    success = true,
                    message = "Continuing task with next steps",
                    actions = listOf(AccessibilityAction.ClickOnText("Alarm")) // Exemple
                )
            } else {
                CommandResult(success = false, message = "Could not parse continuation response")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing continuation: ${e.message}", e)
            CommandResult(success = false, message = "Parsing error: ${e.message}")
        }
    }

    /**
     * Démarrer une nouvelle tâche complexe
     */
    fun startComplexTask(taskType: String, originalCommand: String) {
        Log.d(TAG, "Starting complex task: $taskType")

        prefs.edit()
            .putString(KEY_CURRENT_TASK, taskType)
            .putString(KEY_ORIGINAL_COMMAND, originalCommand)
            .putInt(KEY_TASK_STEP, 0)
            .apply()
    }

    private fun updateTaskStep(newStep: Int) {
        prefs.edit().putInt(KEY_TASK_STEP, newStep).apply()
        Log.d(TAG, "Updated task step to: $newStep")
    }

    private fun clearTaskContext() {
        prefs.edit().clear().apply()
        Log.d(TAG, "Cleared task context")
    }

    /**
     * Vérifier s'il y a une tâche en cours
     */
    fun hasOngoingTask(): Boolean {
        return prefs.getString(KEY_CURRENT_TASK, null) != null
    }

    /**
     * Obtenir le statut de la tâche actuelle
     */
    fun getCurrentTaskStatus(): String? {
        val task = prefs.getString(KEY_CURRENT_TASK, null)
        val step = prefs.getInt(KEY_TASK_STEP, 0)
        return if (task != null) "$task (step $step)" else null
    }
}