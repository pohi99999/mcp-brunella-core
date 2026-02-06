package com.voiceassistant.commands

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import android.speech.tts.TextToSpeech
import android.telephony.SmsManager
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.*

class CommandProcessor(
    private val context: Context,
    private val textToSpeech: TextToSpeech
) {
    
    fun processCommand(command: String) {
        val lowerCommand = command.lowercase().trim()
        
        when {
            lowerCommand.startsWith("call") -> handleCallCommand(lowerCommand)
            lowerCommand.startsWith("send message") -> handleSmsCommand(lowerCommand)
            lowerCommand.startsWith("open") -> handleOpenAppCommand(lowerCommand)
            lowerCommand.contains("time") -> handleTimeCommand()
            lowerCommand.contains("help") -> handleHelpCommand()
            lowerCommand.contains("notifications") -> handleNotificationsCommand()
            else -> handleUnknownCommand(command)
        }
    }
    
    private fun handleCallCommand(command: String) {
        // Extract contact name from "call [contact name]"
        val contactName = command.removePrefix("call").trim()
        
        if (contactName.isEmpty()) {
            speakText("Please specify who you want to call")
            return
        }
        
        val phoneNumber = getContactPhoneNumber(contactName)
        if (phoneNumber != null) {
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$phoneNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            
            try {
                context.startActivity(intent)
                speakText("Calling $contactName")
            } catch (e: Exception) {
                speakText("Unable to make the call. Please check permissions.")
            }
        } else {
            speakText("Contact $contactName not found")
        }
    }
    
    private fun handleSmsCommand(command: String) {
        // Extract contact and message from "send message to [contact] saying [message]"
        val regex = "send message to (.+?) saying (.+)".toRegex()
        val matchResult = regex.find(command)
        
        if (matchResult != null) {
            val contactName = matchResult.groupValues[1].trim()
            val message = matchResult.groupValues[2].trim()
            
            val phoneNumber = getContactPhoneNumber(contactName)
            if (phoneNumber != null) {
                try {
                    val smsManager = SmsManager.getDefault()
                    smsManager.sendTextMessage(phoneNumber, null, message, null, null)
                    speakText("Message sent to $contactName")
                } catch (e: Exception) {
                    speakText("Unable to send message. Please check permissions.")
                }
            } else {
                speakText("Contact $contactName not found")
            }
        } else {
            speakText("Please use the format: send message to contact name saying your message")
        }
    }
    
    private fun handleOpenAppCommand(command: String) {
        val appName = command.removePrefix("open").trim()
        
        if (appName.isEmpty()) {
            speakText("Please specify which app to open")
            return
        }
        
        val packageName = getAppPackageName(appName)
        if (packageName != null) {
            val intent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(intent)
                speakText("Opening $appName")
            } else {
                speakText("Unable to open $appName")
            }
        } else {
            speakText("App $appName not found")
        }
    }
    
    private fun handleTimeCommand() {
        val currentTime = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date())
        speakText("The current time is $currentTime")
    }
    
    private fun handleHelpCommand() {
        val helpText = """
            Here are the available commands:
            Say 'call' followed by a contact name to make a phone call.
            Say 'send message to' contact name 'saying' your message to send SMS.
            Say 'open' followed by an app name to launch applications.
            Say 'what time is it' to hear the current time.
            Say 'read notifications' to hear your notifications.
        """.trimIndent()
        speakText(helpText)
    }
    
    private fun handleNotificationsCommand() {
        // This would require notification access permission
        speakText("Notification reading feature requires additional setup in accessibility settings")
    }
    
    private fun handleUnknownCommand(command: String) {
        speakText("I didn't understand '$command'. Say 'help' to hear available commands.")
    }
    
    private fun getContactPhoneNumber(contactName: String): String? {
        val cursor = context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
            arrayOf("%$contactName%"),
            null
        )
        
        cursor?.use {
            if (it.moveToFirst()) {
                val phoneNumberIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                return it.getString(phoneNumberIndex)
            }
        }
        return null
    }
    
    private fun getAppPackageName(appName: String): String? {
        val packageManager = context.packageManager
        val installedApps = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
        
        for (app in installedApps) {
            val appLabel = packageManager.getApplicationLabel(app).toString()
            if (appLabel.lowercase().contains(appName.lowercase())) {
                return app.packageName
            }
        }
        
        // Common app mappings
        return when (appName.lowercase()) {
            "phone", "dialer" -> "com.android.dialer"
            "messages", "sms" -> "com.android.mms"
            "contacts" -> "com.android.contacts"
            "settings" -> "com.android.settings"
            "camera" -> "com.android.camera"
            "gallery", "photos" -> "com.android.gallery3d"
            else -> null
        }
    }
    
    private fun speakText(text: String) {
        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
    }
}
