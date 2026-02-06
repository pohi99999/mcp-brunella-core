package com.voiceassistant.model


import kotlinx.serialization.Serializable

@Serializable
sealed class AccessibilityAction {
    @Serializable
    data class Click(val x: Int, val y: Int) : AccessibilityAction()

    @Serializable
    data class ClickOnText(val text: String) : AccessibilityAction()

    @Serializable
    data class Scroll(val direction: ScrollDirection) : AccessibilityAction()

    @Serializable
    data class Type(val text: String) : AccessibilityAction()

    @Serializable
    object Screenshot : AccessibilityAction()

    @Serializable
    object GoBack : AccessibilityAction()

    @Serializable
    object GoHome : AccessibilityAction()

    @Serializable
    object OpenNotifications : AccessibilityAction()

    @Serializable
    data class Wait(val milliseconds: Long) : AccessibilityAction()

    @Serializable
    data class OpenApp(val packageName: String) : AccessibilityAction()

    @Serializable
    data class SetAlarm(val hour: Int, val minute: Int) : AccessibilityAction()

    @Serializable
    object PressEnter : AccessibilityAction()

}

@Serializable
enum class ScrollDirection {
    UP, DOWN, LEFT, RIGHT
}

@Serializable
data class ActionSequence(
    val actions: List<AccessibilityAction>,
    val description: String = ""
)

@Serializable
data class CommandResult(
    val success: Boolean,
    val message: String,
    val actions: List<AccessibilityAction> = emptyList()
)