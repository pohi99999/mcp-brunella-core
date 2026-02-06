package com.voiceassistant.network

import com.voiceassistant.model.LlamaRequest
import com.voiceassistant.model.LlamaResponse
import retrofit2.http.Body
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Streaming

interface LlamaApi {
    @Headers("Content-Type: application/json")
    @POST("/api/generate")
    suspend fun generate(@Body request: LlamaRequest): LlamaResponse
    
    @Headers("Content-Type: application/json")
    @POST("/api/generate")
    @Streaming
    suspend fun generateStream(@Body request: LlamaRequest): retrofit2.Response<okhttp3.ResponseBody>
}