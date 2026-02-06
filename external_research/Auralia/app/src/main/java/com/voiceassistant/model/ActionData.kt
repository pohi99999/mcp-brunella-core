package com.voiceassistant.model

import kotlinx.serialization.Serializable

@Serializable
data class ActionData(
    val type: String,
    val x: Int? = null,
    val y: Int? = null,
    val text: String? = null,
    val direction: String? = null,
    val milliseconds: Long? = null,
    val packageName: String? = null,
    val hour: Int? = null,
    val minute: Int? = null
)

@Serializable
data class AIResponse(
    val success: Boolean,
    val message: String,
    val actions: List<ActionData> = emptyList()
)
