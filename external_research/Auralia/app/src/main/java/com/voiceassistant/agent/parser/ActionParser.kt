package com.voiceassistant.agent.parser

import android.graphics.Rect
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.voiceassistant.agent.core.*
import java.util.*

/**
 * Parser for converting JSON model responses into Action objects
 */
class ActionParser {
    private val gson = Gson()

    /**
     * Parse a JSON string into a ModelResponse with Action
     */
    fun parseModelResponse(jsonString: String): ModelResponse {
        return try {
            val jsonElement = gson.fromJson(jsonString, com.google.gson.JsonElement::class.java)
            val jsonObject = jsonElement.asJsonObject
            val action = parseAction(jsonObject.getAsJsonObject("action"))
            val reasoning = jsonObject.get("reasoning")?.asString
            val confidence = jsonObject.get("confidence")?.asFloat ?: 1.0f
            val requiresScreenshot = jsonObject.get("requires_screenshot")?.asBoolean ?: false

            ModelResponse(
                action = action,
                reasoning = reasoning,
                confidence = confidence,
                requiresScreenshot = requiresScreenshot
            )
        } catch (e: Exception) {
            throw ActionParseException("Failed to parse model response: $jsonString", e)
        }
    }

    /**
     * Parse a JSON object into an Action
     */
    fun parseAction(actionJson: JsonObject): Action {
        val actionType = actionJson.get("type").asString
        val id = actionJson.get("id")?.asString ?: UUID.randomUUID().toString()
        val description = actionJson.get("description")?.asString ?: "Execute $actionType"

        return when (actionType.lowercase()) {
            "tap" -> parseTapAction(id, description, actionJson)
            "long_press" -> parseLongPressAction(id, description, actionJson)
            "scroll" -> parseScrollAction(id, description, actionJson)
            "text_input" -> parseTextInputAction(id, description, actionJson)
            "open_app" -> parseOpenAppAction(id, description, actionJson)
            "wait" -> parseWaitAction(id, description, actionJson)
            "screenshot" -> parseScreenshotAction(id, description, actionJson)
            "complete" -> parseCompleteAction(id, description, actionJson)
            else -> throw ActionParseException("Unknown action type: $actionType")
        }
    }

    private fun parseTapAction(id: String, description: String, json: JsonObject): TapAction {
        return TapAction(
            id = id,
            description = description,
            targetText = json.get("target_text")?.asString,
            targetId = json.get("target_id")?.asString,
            bounds = parseBounds(json.get("bounds")?.asJsonObject),
            confidence = json.get("confidence")?.asFloat ?: 1.0f
        )
    }

    private fun parseLongPressAction(id: String, description: String, json: JsonObject): LongPressAction {
        return LongPressAction(
            id = id,
            description = description,
            targetText = json.get("target_text")?.asString,
            targetId = json.get("target_id")?.asString,
            bounds = parseBounds(json.get("bounds")?.asJsonObject),
            duration = json.get("duration")?.asLong ?: 1000L
        )
    }

    private fun parseScrollAction(id: String, description: String, json: JsonObject): ScrollAction {
        val directionStr = json.get("direction").asString
        val direction = when (directionStr.uppercase()) {
            "UP" -> ScrollDirection.UP
            "DOWN" -> ScrollDirection.DOWN
            "LEFT" -> ScrollDirection.LEFT
            "RIGHT" -> ScrollDirection.RIGHT
            else -> throw ActionParseException("Invalid scroll direction: $directionStr")
        }

        return ScrollAction(
            id = id,
            description = description,
            direction = direction,
            distance = json.get("distance")?.asInt ?: 500
        )
    }

    private fun parseTextInputAction(id: String, description: String, json: JsonObject): TextInputAction {
        return TextInputAction(
            id = id,
            description = description,
            targetText = json.get("target_text")?.asString,
            targetId = json.get("target_id")?.asString,
            text = json.get("text").asString,
            clearFirst = json.get("clear_first")?.asBoolean ?: true
        )
    }

    private fun parseOpenAppAction(id: String, description: String, json: JsonObject): OpenAppAction {
        return OpenAppAction(
            id = id,
            description = description,
            packageName = json.get("package_name").asString,
            activityName = json.get("activity_name")?.asString
        )
    }

    private fun parseWaitAction(id: String, description: String, json: JsonObject): WaitAction {
        return WaitAction(
            id = id,
            description = description,
            duration = json.get("duration").asLong,
            waitForText = json.get("wait_for_text")?.asString
        )
    }

    private fun parseScreenshotAction(id: String, description: String, json: JsonObject): ScreenshotAction {
        return ScreenshotAction(
            id = id,
            description = description,
            includeOcr = json.get("include_ocr")?.asBoolean ?: true
        )
    }

    private fun parseCompleteAction(id: String, description: String, json: JsonObject): CompleteAction {
        return CompleteAction(
            id = id,
            description = description,
            success = json.get("success")?.asBoolean ?: true,
            message = json.get("message")?.asString
        )
    }

    private fun parseBounds(boundsJson: JsonObject?): Rect? {
        if (boundsJson == null) return null

        return Rect(
            boundsJson.get("left").asInt,
            boundsJson.get("top").asInt,
            boundsJson.get("right").asInt,
            boundsJson.get("bottom").asInt
        )
    }

    /**
     * Create a prompt for the model with current context
     */
    fun createPrompt(
        userRequest: String,
        screenText: String? = null,
        previousActions: List<Action> = emptyList(),
        maxActions: Int = 5
    ): String {
        val prompt = StringBuilder()
        prompt.append("You are an Android UI automation agent. ")
        prompt.append("The user wants to: $userRequest\n\n")

        if (screenText != null) {
            prompt.append("Current screen contains this text:\n")
            prompt.append(screenText)
            prompt.append("\n\n")
        }

        if (previousActions.isNotEmpty()) {
            prompt.append("Previous actions taken:\n")
            previousActions.takeLast(maxActions).forEach { action ->
                prompt.append("- ${action.description}\n")
            }
            prompt.append("\n")
        }

        prompt.append("""
            Respond with a JSON object containing the next action to take:
            {
                "action": {
                    "type": "action_type",
                    "id": "unique_id",
                    "description": "human readable description",
                    ... (other action-specific fields)
                },
                "reasoning": "explanation of why this action was chosen",
                "confidence": 0.95,
                "requires_screenshot": false
            }
            
            Available action types:
            - tap: Tap on a UI element
            - long_press: Long press on a UI element  
            - scroll: Scroll in a direction
            - text_input: Enter text into a field
            - open_app: Launch an app
            - wait: Wait for UI to load
            - screenshot: Take screenshot and extract text
            - complete: Task is finished
            
            If the task is complete, use "complete" action type.
        """.trimIndent())

        return prompt.toString()
    }
}

/**
 * Exception thrown when action parsing fails
 */
class ActionParseException(message: String, cause: Throwable? = null) : Exception(message, cause) 