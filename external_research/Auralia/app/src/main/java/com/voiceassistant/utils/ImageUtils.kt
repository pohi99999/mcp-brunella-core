package com.voiceassistant.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.IOException

object ImageUtils {
    
    fun imageToBase64(context: Context, imageUri: Uri, maxSize: Int = 1024): String? {
        return try {
            Log.d("ImageUtils", "Converting image to base64: $imageUri")
            val inputStream = context.contentResolver.openInputStream(imageUri)
            val originalBitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()
            
            if (originalBitmap == null) {
                Log.e("ImageUtils", "Failed to decode image")
                return null
            }
            
            // Resize image if it's too large
            val resizedBitmap = resizeBitmap(originalBitmap, maxSize)
            
            // Convert to base64
            val byteArrayOutputStream = ByteArrayOutputStream()
            resizedBitmap.compress(Bitmap.CompressFormat.JPEG, 80, byteArrayOutputStream)
            val byteArray = byteArrayOutputStream.toByteArray()
            
            val base64String = Base64.encodeToString(byteArray, Base64.NO_WRAP)
            Log.d("ImageUtils", "Image converted to base64 successfully, length: ${base64String.length}")
            base64String
        } catch (e: IOException) {
            Log.e("ImageUtils", "Error converting image to base64", e)
            null
        }
    }
    
    private fun resizeBitmap(bitmap: Bitmap, maxSize: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        
        if (width <= maxSize && height <= maxSize) {
            return bitmap
        }
        
        val ratio = minOf(maxSize.toFloat() / width, maxSize.toFloat() / height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()
        
        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }
} 