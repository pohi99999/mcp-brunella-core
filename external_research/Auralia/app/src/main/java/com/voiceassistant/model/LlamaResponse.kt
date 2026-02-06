package com.voiceassistant.model

data class LlamaResponse(
    val response: String,
    val done: Boolean = false,
    val model: String = "",
    val created_at: String = "",
    val done_reason: String? = null
)