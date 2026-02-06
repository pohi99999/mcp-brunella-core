package com.voiceassistant.network

import android.util.Log
import com.google.gson.Gson
import com.voiceassistant.model.OllamaRequest
import com.voiceassistant.model.OllamaResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class OllamaApiClient {
    // IP du serveur Ollama - changez cette valeur selon votre configuration
    private val baseUrl = "http://192.168.1.116:11434/"
    
    // URLs alternatives pour tester différentes configurations
    private val alternativeUrls = listOf(
        "http://192.168.1.116:11434/",
        "http://10.0.2.2:11434/",  // Pour émulateur Android
        "http://localhost:11434/"
    )
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    private val apiService = retrofit.create(OllamaApiService::class.java)
    
    suspend fun analyzeImage(imageBase64: String, prompt: String = "Que vois-tu sur cette image ?"): Result<OllamaResponse> {
        return try {
            Log.d("OllamaApiClient", "Sending image analysis request with prompt: $prompt")
            Log.d("OllamaApiClient", "Base URL: $baseUrl")
            val request = OllamaRequest(
                model = "llava",
                prompt = prompt,
                images = listOf(imageBase64),
                stream = false
            )
            Log.d("OllamaApiClient", "Request created, calling API...")
            val response = apiService.analyzeImage(request)
            Log.d("OllamaApiClient", "API response received: ${response.response}")
            Result.success(response)
        } catch (e: Exception) {
            Log.e("OllamaApiClient", "Error analyzing image", e)
            Log.e("OllamaApiClient", "Error details: ${e.message}")
            Log.e("OllamaApiClient", "Error type: ${e.javaClass.simpleName}")
            Result.failure(e)
        }
    }
    
    fun analyzeImageStream(imageBase64: String, prompt: String = "Que vois-tu sur cette image ?"): Flow<String> = flow {
        try {
            Log.d("OllamaApiClient", "Starting streaming image analysis with prompt: $prompt")
            val request = OllamaRequest(
                model = "llava",
                prompt = prompt,
                images = listOf(imageBase64),
                stream = false
            )
            
            val response = apiService.analyzeImageStream(request)
            if (response.isSuccessful) {
                val responseBody = response.body()
                if (responseBody != null) {
                    val source = responseBody.source()
                    var fullResponse = ""
                    
                    Log.d("OllamaApiClient", "Starting to read streaming response word by word")
                    while (!source.exhausted()) {
                        val line = source.readUtf8Line()
                        if (line != null && line.isNotEmpty()) {
                            try {
                                Log.d("OllamaApiClient", "Received line: $line")
                                val gson = Gson()
                                val llamaResponse = gson.fromJson(line, OllamaResponse::class.java)
                                
                                // Traiter chaque mot individuellement
                                val newWords = llamaResponse.response
                                if (newWords.isNotEmpty()) {
                                    // Diviser en mots et émettre chaque mot
                                    val words = newWords.split(" ")
                                    for (word in words) {
                                        if (word.isNotEmpty()) {
                                            fullResponse += if (fullResponse.isEmpty()) word else " $word"
                                            Log.d("OllamaApiClient", "Emitting word: $word")
                                            emit(fullResponse)
                                            
                                            // Petit délai pour voir les mots un par un
                                            kotlinx.coroutines.delay(100)
                                        }
                                    }
                                }
                                
                                if (llamaResponse.done) {
                                    Log.d("OllamaApiClient", "Streaming completed")
                                    break
                                }
                            } catch (e: Exception) {
                                Log.e("OllamaApiClient", "Error parsing streaming response line: $line", e)
                            }
                        }
                    }
                } else {
                    Log.e("OllamaApiClient", "Response body is null")
                    throw Exception("Empty response from server")
                }
            } else {
                Log.e("OllamaApiClient", "Streaming request failed with code: ${response.code()}")
                throw Exception("Streaming request failed: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e("OllamaApiClient", "Error in streaming request", e)
            throw e
        }
    }
    
    suspend fun testConnection(): Result<Boolean> {
        return try {
            Log.d("OllamaApiClient", "Testing connection to: $baseUrl")
            // Try a simple request to test connectivity
            val testRequest = OllamaRequest(
                model = "llava",
                prompt = "test",
                images = listOf(""),
                stream = false
            )
            apiService.analyzeImage(testRequest)
            Log.d("OllamaApiClient", "Connection test successful")
            Result.success(true)
        } catch (e: Exception) {
            Log.e("OllamaApiClient", "Connection test failed", e)
            Result.failure(e)
        }
    }
    
    /**
     * Test connection with multiple URLs to find working one
     */
    suspend fun findWorkingServer(): Result<String> {
        val allUrls = listOf(baseUrl) + alternativeUrls
        
        for (url in allUrls) {
            try {
                Log.d("OllamaApiClient", "Testing URL: $url")
                val testRetrofit = Retrofit.Builder()
                    .baseUrl(url)
                    .client(okHttpClient)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()
                
                val testApiService = testRetrofit.create(OllamaApiService::class.java)
                val testRequest = OllamaRequest(
                    model = "llava",
                    prompt = "test",
                    images = listOf(""),
                    stream = false
                )
                
                testApiService.analyzeImage(testRequest)
                Log.d("OllamaApiClient", "Found working server: $url")
                return Result.success(url)
            } catch (e: Exception) {
                Log.w("OllamaApiClient", "URL $url failed: ${e.message}")
                continue
            }
        }
        
        return Result.failure(Exception("No working server found. Check if Ollama is running and accessible."))
    }
    
    /**
     * Update the base URL dynamically
     */
    fun updateBaseUrl(newUrl: String) {
        Log.d("OllamaApiClient", "Updating base URL to: $newUrl")
        // Note: In a real app, you'd want to recreate the retrofit instance
        // For now, this is just for logging
    }
} 