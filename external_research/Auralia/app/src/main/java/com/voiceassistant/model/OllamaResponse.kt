package com.voiceassistant.model

data class OllamaResponse(
    val response: String,
    val done: Boolean = false
) 