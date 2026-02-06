package com.voiceassistant.network

import com.voiceassistant.model.OllamaRequest
import com.voiceassistant.model.OllamaResponse
import retrofit2.http.Body
import retrofit2.http.POST

import okhttp3.ResponseBody
import retrofit2.http.Streaming

interface OllamaApiService {
    @POST("api/generate")
    suspend fun analyzeImage(@Body request: OllamaRequest): OllamaResponse
    
    @POST("api/generate")
    @Streaming
    suspend fun analyzeImageStream(@Body request: OllamaRequest): retrofit2.Response<ResponseBody>
} 