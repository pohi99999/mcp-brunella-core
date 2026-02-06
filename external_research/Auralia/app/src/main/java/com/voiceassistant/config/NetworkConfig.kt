package com.voiceassistant.config

import android.content.Context
import android.content.SharedPreferences

/**
 * Network configuration for the app
 * Allows easy customization of server URLs without code changes
 */
object NetworkConfig {
    
    // Default Ollama server URL - change this to your server's IP
    private const val DEFAULT_OLLAMA_URL = "http://192.168.1.116:11434/"
    
    // SharedPreferences key for storing the custom URL
    private const val PREF_OLLAMA_URL = "ollama_server_url"
    
    /**
     * Get the Ollama server URL
     * Priority: Custom URL from settings > Default URL
     */
    fun getOllamaUrl(context: Context): String {
        val prefs = context.getSharedPreferences("network_config", Context.MODE_PRIVATE)
        return prefs.getString(PREF_OLLAMA_URL, DEFAULT_OLLAMA_URL) ?: DEFAULT_OLLAMA_URL
    }
    
    /**
     * Set a custom Ollama server URL
     */
    fun setOllamaUrl(context: Context, url: String) {
        val prefs = context.getSharedPreferences("network_config", Context.MODE_PRIVATE)
        prefs.edit().putString(PREF_OLLAMA_URL, url).apply()
    }
    
    /**
     * Reset to default URL
     */
    fun resetToDefault(context: Context) {
        val prefs = context.getSharedPreferences("network_config", Context.MODE_PRIVATE)
        prefs.edit().remove(PREF_OLLAMA_URL).apply()
    }
    
    /**
     * Get the default URL for reference
     */
    fun getDefaultUrl(): String = DEFAULT_OLLAMA_URL
    
    /**
     * Check if using custom URL
     */
    fun isUsingCustomUrl(context: Context): Boolean {
        val prefs = context.getSharedPreferences("network_config", Context.MODE_PRIVATE)
        val customUrl = prefs.getString(PREF_OLLAMA_URL, null)
        return customUrl != null && customUrl != DEFAULT_OLLAMA_URL
    }
} 