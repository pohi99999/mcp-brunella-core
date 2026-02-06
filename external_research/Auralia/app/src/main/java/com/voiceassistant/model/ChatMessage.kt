package com.voiceassistant.model

import java.util.Date

data class ChatMessage(
    val id: String = System.currentTimeMillis().toString(),
    val content: String,
    val isUser: Boolean,
    val timestamp: Date = Date(),
    val model: String = ""
) 