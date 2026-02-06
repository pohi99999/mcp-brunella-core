package com.voiceassistant.model

data class LlamaRequest(
    val model: String,
    val prompt: String,
    val stream: Boolean = false
)