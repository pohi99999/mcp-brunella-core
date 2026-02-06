package com.voiceassistant.agent.core

import android.content.Context
import android.graphics.Rect
import kotlinx.coroutines.flow.Flow

/**
 * Interface for executing UI actions
 */
interface ActionExecutor {
    suspend fun executeAction(action: Action): ExecutionResult
    suspend fun takeScreenshot(): ScreenshotResult
    suspend fun performOcr(imageData: ByteArray): OcrResult
    fun isAvailable(): Boolean
}

/**
 * Result of action execution
 */
data class ExecutionResult(
    val success: Boolean,
    val message: String? = null,
    val error: Throwable? = null,
    val screenshotTaken: Boolean = false
)

/**
 * Result of screenshot capture
 */
data class ScreenshotResult(
    val success: Boolean,
    val imageData: ByteArray? = null,
    val error: Throwable? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as ScreenshotResult

        if (success != other.success) return false
        if (imageData != null) {
            if (other.imageData == null) return false
            if (!imageData.contentEquals(other.imageData)) return false
        } else if (other.imageData != null) return false
        if (error != other.error) return false

        return true
    }

    override fun hashCode(): Int {
        var result = success.hashCode()
        result = 31 * result + (imageData?.contentHashCode() ?: 0)
        result = 31 * result + (error?.hashCode() ?: 0)
        return result
    }
}

/**
 * Result of OCR processing
 */
data class OcrResult(
    val success: Boolean,
    val text: String = "",
    val textBlocks: List<TextBlock> = emptyList(),
    val error: Throwable? = null
)

/**
 * Text block with position information
 */
data class TextBlock(
    val text: String,
    val bounds: Rect,
    val confidence: Float = 1.0f
)

/**
 * Accessibility-based action executor
 */
class AccessibilityActionExecutor(
    private val context: Context
) : ActionExecutor {
    
    override suspend fun executeAction(action: Action): ExecutionResult {
        return try {
            when (action) {
                is TapAction -> executeTap(action)
                is LongPressAction -> executeLongPress(action)
                is ScrollAction -> executeScroll(action)
                is TextInputAction -> executeTextInput(action)
                is OpenAppAction -> executeOpenApp(action)
                is WaitAction -> executeWait(action)
                is ScreenshotAction -> executeScreenshot(action)
                is CompleteAction -> ExecutionResult(true, action.message)
            }
        } catch (e: Exception) {
            ExecutionResult(false, "Failed to execute action: ${action.description}", e)
        }
    }

    override suspend fun takeScreenshot(): ScreenshotResult {
        // Implementation will be added when we integrate with AccessibilityService
        return ScreenshotResult(false, null, Exception("Not implemented yet"))
    }

    override suspend fun performOcr(imageData: ByteArray): OcrResult {
        // Implementation will be added when we integrate OCR
        return OcrResult(false, "", emptyList(), Exception("Not implemented yet"))
    }

    override fun isAvailable(): Boolean {
        // Check if accessibility service is enabled
        return false // Will be implemented
    }

    private suspend fun executeTap(action: TapAction): ExecutionResult {
        // Find element by text or ID and tap it
        // This will be implemented with AccessibilityService
        return ExecutionResult(true, "Tapped ${action.targetText ?: action.targetId}")
    }

    private suspend fun executeLongPress(action: LongPressAction): ExecutionResult {
        // Find element and long press it
        return ExecutionResult(true, "Long pressed ${action.targetText ?: action.targetId}")
    }

    private suspend fun executeScroll(action: ScrollAction): ExecutionResult {
        // Perform scroll in specified direction
        return ExecutionResult(true, "Scrolled ${action.direction}")
    }

    private suspend fun executeTextInput(action: TextInputAction): ExecutionResult {
        // Find input field and enter text
        return ExecutionResult(true, "Entered text: ${action.text}")
    }

    private suspend fun executeOpenApp(action: OpenAppAction): ExecutionResult {
        // Launch app using package manager
        return ExecutionResult(true, "Opened app: ${action.packageName}")
    }

    private suspend fun executeWait(action: WaitAction): ExecutionResult {
        // Wait for specified duration or text to appear
        kotlinx.coroutines.delay(action.duration)
        return ExecutionResult(true, "Waited for ${action.duration}ms")
    }

    private suspend fun executeScreenshot(action: ScreenshotAction): ExecutionResult {
        val screenshotResult = takeScreenshot()
        return ExecutionResult(
            screenshotResult.success,
            "Screenshot taken",
            screenshotResult.error,
            screenshotResult.success
        )
    }
}

/**
 * Media projection-based action executor
 */
class MediaProjectionActionExecutor(
    private val context: Context
) : ActionExecutor {
    
    override suspend fun executeAction(action: Action): ExecutionResult {
        // Media projection can only capture screen, not perform actions
        // This would need to be combined with other methods for full automation
        return ExecutionResult(false, "Media projection cannot execute actions directly")
    }

    override suspend fun takeScreenshot(): ScreenshotResult {
        // Implementation will be added when we integrate MediaProjection
        return ScreenshotResult(false, null, Exception("Not implemented yet"))
    }

    override suspend fun performOcr(imageData: ByteArray): OcrResult {
        // Same OCR implementation as accessibility executor
        return OcrResult(false, "", emptyList(), Exception("Not implemented yet"))
    }

    override fun isAvailable(): Boolean {
        // Check if media projection permission is granted
        return false // Will be implemented
    }
} 