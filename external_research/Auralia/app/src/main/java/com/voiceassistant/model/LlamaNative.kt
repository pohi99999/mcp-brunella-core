package com.voiceassistant.model

object LlamaNative {
    init {
        System.loadLibrary("llama")
    }
    external fun getLlamaVersion(): String
}