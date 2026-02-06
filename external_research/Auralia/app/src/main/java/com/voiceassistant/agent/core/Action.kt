package com.voiceassistant.agent.core

import android.graphics.Rect

/**
 * Base interface for all UI actions that can be executed by the agent
 */
sealed interface Action {
    val id: String
    val description: String
}

/**
 * Tap action on a UI element
 */
data class TapAction(
    override val id: String,
    override val description: String,
    val targetText: String? = null,
    val targetId: String? = null,
    val bounds: Rect? = null,
    val confidence: Float = 1.0f
) : Action

/**
 * Long press action on a UI element
 */
data class LongPressAction(
    override val id: String,
    override val description: String,
    val targetText: String? = null,
    val targetId: String? = null,
    val bounds: Rect? = null,
    val duration: Long = 1000L
) : Action

/**
 * Scroll action in a specific direction
 */
data class ScrollAction(
    override val id: String,
    override val description: String,
    val direction: ScrollDirection,
    val distance: Int = 500
) : Action

enum class ScrollDirection {
    UP, DOWN, LEFT, RIGHT
}

/**
 * Text input action
 */
data class TextInputAction(
    override val id: String,
    override val description: String,
    val targetText: String? = null,
    val targetId: String? = null,
    val text: String,
    val clearFirst: Boolean = true
) : Action

/**
 * Open app action
 */
data class OpenAppAction(
    override val id: String,
    override val description: String,
    val packageName: String,
    val activityName: String? = null
) : Action

/**
 * Wait action for UI to load
 */
data class WaitAction(
    override val id: String,
    override val description: String,
    val duration: Long,
    val waitForText: String? = null
) : Action

/**
 * Screenshot and OCR action
 */
data class ScreenshotAction(
    override val id: String,
    override val description: String,
    val includeOcr: Boolean = true
) : Action

/**
 * Complete action - indicates task is finished
 */
data class CompleteAction(
    override val id: String,
    override val description: String,
    val success: Boolean = true,
    val message: String? = null
) : Action
//
/**
 * Model response containing the next action to execute
 */
data class ModelResponse(
    val action: Action,
    val reasoning: String? = null,
    val confidence: Float = 1.0f,
    val requiresScreenshot: Boolean = false
) 