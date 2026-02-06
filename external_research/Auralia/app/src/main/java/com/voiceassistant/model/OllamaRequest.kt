package com.voiceassistant.model

data class OllamaRequest(
    val model: String,
    val prompt: String,
    val images: List<String>,
    val stream: Boolean = false
) 