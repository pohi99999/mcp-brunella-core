package com.voiceassistant.agent.example

import android.content.Context
import android.util.Log
import com.voiceassistant.agent.VoiceAgent
import com.voiceassistant.agent.core.AccessibilityActionExecutor
import com.voiceassistant.agent.core.Action
import com.voiceassistant.agent.core.CompleteAction
import com.voiceassistant.agent.core.TapAction
import com.voiceassistant.agent.parser.ActionParser
import kotlinx.coroutines.flow.collectLatest
import java.util.*

/**
 * Example demonstrating the complete automation loop
 */
class AgentExample(private val context: Context) {
    
    private val voiceAgent = VoiceAgent(context)
    private val parser = ActionParser()

    /**
     * Example: Simulate opening Settings app
     */
    suspend fun exampleOpenSettings() {
        Log.d("AgentExample", "Starting example: Open Settings")
        
        // Set up action executor
        val executor = AccessibilityActionExecutor(context)
        voiceAgent.setActionExecutor(executor)
        
        // Start the task
        voiceAgent.startTask("Open the Settings app")
        
        // Monitor progress
        voiceAgent.isRunning.collectLatest { isRunning ->
            if (isRunning) {
                Log.d("AgentExample", "Agent is running: ${voiceAgent.getStatus()}")
            } else {
                Log.d("AgentExample", "Agent finished: ${voiceAgent.getStatus()}")
            }
        }
    }

    /**
     * Example: Simulate a complete automation loop manually
     */
    suspend fun exampleManualLoop() {
        Log.d("AgentExample", "Starting manual example loop")
        
        val userRequest = "Open the Settings app and go to About Phone"
        var screenText = "Home screen with app icons"
        val previousActions = mutableListOf<Action>()
        
        // Simulate the automation loop
        for (iteration in 0 until 5) {
            Log.d("AgentExample", "=== Iteration $iteration ===")
            
            // 1. Create prompt for the model
            val prompt = parser.createPrompt(
                userRequest = userRequest,
                screenText = screenText,
                previousActions = previousActions
            )
            
            Log.d("AgentExample", "Prompt: $prompt")
            
            // 2. Simulate model response (in real app, this would come from Ollama)
            val modelResponse = simulateModelResponse(iteration, screenText)
            Log.d("AgentExample", "Model response: $modelResponse")
            
            // 3. Parse the response
            val parsedResponse = parser.parseModelResponse(modelResponse)
            Log.d("AgentExample", "Parsed action: ${parsedResponse.action.description}")
            
            // 4. Simulate action execution
            val executionResult = simulateActionExecution(parsedResponse.action)
            Log.d("AgentExample", "Execution result: ${executionResult.message}")
            
            // 5. Update state
            previousActions.add(parsedResponse.action)
            
            // 6. Simulate new screen text
            screenText = simulateNewScreenText(iteration, parsedResponse.action)
            Log.d("AgentExample", "New screen text: $screenText")
            
            // Check if complete
            if (parsedResponse.action is CompleteAction) {
                Log.d("AgentExample", "Task completed!")
                break
            }
            
            Log.d("AgentExample", "--- End iteration $iteration ---\n")
        }
    }

    /**
     * Simulate model responses for the example
     */
    private fun simulateModelResponse(iteration: Int, screenText: String): String {
        return when (iteration) {
            0 -> {
                """
                {
                    "action": {
                        "type": "tap",
                        "id": "tap_settings",
                        "description": "Tap on Settings app icon",
                        "target_text": "Settings"
                    },
                    "reasoning": "I need to find and tap the Settings app icon to open it",
                    "confidence": 0.95,
                    "requires_screenshot": false
                }
                """.trimIndent()
            }
            1 -> {
                """
                {
                    "action": {
                        "type": "wait",
                        "id": "wait_settings_load",
                        "description": "Wait for Settings app to load",
                        "duration": 2000
                    },
                    "reasoning": "Need to wait for the Settings app to fully load before proceeding",
                    "confidence": 0.9,
                    "requires_screenshot": false
                }
                """.trimIndent()
            }
            2 -> {
                """
                {
                    "action": {
                        "type": "scroll",
                        "id": "scroll_down",
                        "description": "Scroll down to find About Phone",
                        "direction": "DOWN",
                        "distance": 300
                    },
                    "reasoning": "About Phone is typically found in the bottom section of Settings",
                    "confidence": 0.85,
                    "requires_screenshot": false
                }
                """.trimIndent()
            }
            3 -> {
                """
                {
                    "action": {
                        "type": "tap",
                        "id": "tap_about_phone",
                        "description": "Tap on About Phone option",
                        "target_text": "About Phone"
                    },
                    "reasoning": "Found About Phone option, tapping to open it",
                    "confidence": 0.95,
                    "requires_screenshot": false
                }
                """.trimIndent()
            }
            else -> {
                """
                {
                    "action": {
                        "type": "complete",
                        "id": "task_complete",
                        "description": "Task completed successfully",
                        "success": true,
                        "message": "Successfully opened Settings and navigated to About Phone"
                    },
                    "reasoning": "The requested task has been completed",
                    "confidence": 1.0,
                    "requires_screenshot": false
                }
                """.trimIndent()
            }
        }
    }

    /**
     * Simulate action execution
     */
    private fun simulateActionExecution(action: Action): com.voiceassistant.agent.core.ExecutionResult {
        return when (action) {
            is TapAction -> com.voiceassistant.agent.core.ExecutionResult(
                success = true,
                message = "Tapped on ${action.targetText ?: action.targetId}"
            )
            is com.voiceassistant.agent.core.WaitAction -> com.voiceassistant.agent.core.ExecutionResult(
                success = true,
                message = "Waited for ${action.duration}ms"
            )
            is com.voiceassistant.agent.core.ScrollAction -> com.voiceassistant.agent.core.ExecutionResult(
                success = true,
                message = "Scrolled ${action.direction} by ${action.distance} pixels"
            )
            is CompleteAction -> com.voiceassistant.agent.core.ExecutionResult(
                success = true,
                message = action.message ?: "Task completed"
            )
            else -> com.voiceassistant.agent.core.ExecutionResult(
                success = true,
                message = "Executed ${action.description}"
            )
        }
    }

    /**
     * Simulate new screen text after action execution
     */
    private fun simulateNewScreenText(iteration: Int, action: Action): String {
        return when (iteration) {
            0 -> "Settings app opened, showing main settings menu with options like Network, Display, Sound, etc."
            1 -> "Settings app fully loaded, showing main settings menu"
            2 -> "Scrolled down in Settings, now showing options like System, About Phone, etc."
            3 -> "About Phone screen opened, showing device information"
            else -> "Task completed successfully"
        }
    }

    /**
     * Example JSON responses for testing the parser
     */
    fun getExampleJsonResponses(): List<String> {
        return listOf(
            // Tap action
            """
            {
                "action": {
                    "type": "tap",
                    "id": "tap_button",
                    "description": "Tap the Submit button",
                    "target_text": "Submit",
                    "confidence": 0.95
                },
                "reasoning": "Need to submit the form",
                "confidence": 0.95,
                "requires_screenshot": false
            }
            """.trimIndent(),
            
            // Scroll action
            """
            {
                "action": {
                    "type": "scroll",
                    "id": "scroll_down",
                    "description": "Scroll down to see more content",
                    "direction": "DOWN",
                    "distance": 500
                },
                "reasoning": "Need to see more content below",
                "confidence": 0.8,
                "requires_screenshot": false
            }
            """.trimIndent(),
            
            // Text input action
            """
            {
                "action": {
                    "type": "text_input",
                    "id": "enter_username",
                    "description": "Enter username in the login field",
                    "target_text": "Username",
                    "text": "john_doe",
                    "clear_first": true
                },
                "reasoning": "Need to enter the username for login",
                "confidence": 0.9,
                "requires_screenshot": false
            }
            """.trimIndent(),
            
            // Complete action
            """
            {
                "action": {
                    "type": "complete",
                    "id": "task_done",
                    "description": "Task completed successfully",
                    "success": true,
                    "message": "Successfully logged into the application"
                },
                "reasoning": "The login task has been completed",
                "confidence": 1.0,
                "requires_screenshot": false
            }
            """.trimIndent()
        )
    }
} 