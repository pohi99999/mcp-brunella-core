package com.voiceassistant.ai

import android.util.Log
import com.voiceassistant.model.*
import com.voiceassistant.repository.LlamaRepository
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import com.voiceassistant.accessibility.VoiceAssistantAccessibilityService

class AICommandInterpreter(private val llamaRepository: LlamaRepository) {

    companion object {
        private const val TAG = "AIInterpreter"

        // Cache pour les commandes fréquentes
        private val COMMAND_CACHE = mutableMapOf<String, CommandResult>()

        // Patterns instantanés (0-5ms)
        private val INSTANT_PATTERNS = mapOf(
            "screenshot" to CommandResult(true, "Taking screenshot", listOf(AccessibilityAction.Screenshot)),
            "capture" to CommandResult(true, "Taking screenshot", listOf(AccessibilityAction.Screenshot)),
            "home" to CommandResult(true, "Going home", listOf(AccessibilityAction.GoHome)),
            "back" to CommandResult(true, "Going back", listOf(AccessibilityAction.GoBack)),
            "retour" to CommandResult(true, "Going back", listOf(AccessibilityAction.GoBack)),
            "scroll down" to CommandResult(true, "Scrolling down", listOf(AccessibilityAction.Scroll(ScrollDirection.DOWN))),
            "scroll up" to CommandResult(true, "Scrolling up", listOf(AccessibilityAction.Scroll(ScrollDirection.UP)))
        )
    }

    private val json = Json {
        ignoreUnknownKeys = true
        prettyPrint = true
        isLenient = true
    }

    // Prompt ULTRA-COURT pour réponse rapide
    private val fastSystemPrompt = """
You are a fast Android AI. JSON only, no explanation.

Format: {"success":true,"message":"Done","actions":[{"type":"ActionType","param":"value"}]}

Actions:
- OpenApp: packageName
- ClickOnText: text
- Type: text
- PressEnter: (no params)
- Scroll: direction
- Click: x,y
- Screenshot
- GoBack
- GoHome
- Wait: milliseconds

Browser search fix: After Type action, ALWAYS add PressEnter action.

USER REQUEST:"""

    // Prompt complet pour les cas complexes
    private val universalSystemPrompt = """
You are an intelligent Android automation AI. Your job is to analyze ANY user request and determine the exact sequence of Android actions needed to accomplish it.

Respond ONLY in JSON. No explanation.

CRITICAL: For web searches in browser:
1. Type the URL or search query
2. ALWAYS add PressEnter action after typing
3. OR click on "Recherche Google" or "Search" button

Use the following format:
{
  "success": true,
  "message": "Short description",
  "actions": [
    { "type": "OpenApp", "packageName": "com.android.chrome" },
    { "type": "Type", "text": "www.example.com" },
    { "type": "PressEnter" }
  ]
}

AVAILABLE ANDROID ACTIONS:
- Click(x, y): Click at screen coordinates
- ClickOnText("text"): Click on UI element with text
- Scroll(direction): Scroll UP/DOWN/LEFT/RIGHT
- Type("text"): Type text in input field
- PressEnter: Press Enter key to submit/search
- Screenshot: Take screenshot
- GoBack: Android back button
- GoHome: Go to home screen
- OpenNotifications: Open notifications
- Wait(milliseconds): Wait before next action
- OpenApp("package"): Open app by package name

COMMON APP PACKAGES:
- Browser: "com.android.chrome"
- YouTube: "com.google.android.youtube"
- WhatsApp: "com.whatsapp"
- Calculator: "com.android.calculator2"
- Settings: "com.android.settings"
- Camera: "com.android.camera2"
- Messages: "com.google.android.apps.messaging"

Think step by step and ALWAYS include PressEnter after typing URLs!
""".trimIndent()

    suspend fun interpretCommand(userCommand: String): CommandResult {
        return withContext(Dispatchers.IO) {
            try {
                val startTime = System.currentTimeMillis()
                val normalizedCommand = userCommand.lowercase().trim()

                Log.d(TAG, "🧠 Processing: $normalizedCommand")

                // 1. CACHE CHECK (0ms)
                COMMAND_CACHE[normalizedCommand]?.let {
                    Log.d(TAG, "✅ Cache hit! 0ms")
                    return@withContext it
                }

                // 2. INSTANT PATTERNS (1-5ms)
                for ((pattern, result) in INSTANT_PATTERNS) {
                    if (normalizedCommand.contains(pattern)) {
                        Log.d(TAG, "⚡ Instant match: $pattern (${System.currentTimeMillis() - startTime}ms)")
                        COMMAND_CACHE[normalizedCommand] = result
                        return@withContext result
                    }
                }

                // 3. LOCAL PROCESSING (10-50ms)
                val localResult = processLocallyOptimized(normalizedCommand)
                if (localResult != null) {
                    Log.d(TAG, "🏃 Local processing: ${System.currentTimeMillis() - startTime}ms")
                    COMMAND_CACHE[normalizedCommand] = localResult
                    return@withContext localResult
                }

                // 4. AI CALL with timeout (only if needed)
                Log.d(TAG, "🤖 Calling AI...")

                val aiResult = withTimeoutOrNull(4000) { // 4 seconds max
                    val prompt = if (normalizedCommand.split(" ").size > 5) {
                        // Commande complexe -> prompt complet
                        "$universalSystemPrompt\n\nUSER REQUEST: \"$userCommand\"\n\nPROVIDE JSON RESPONSE:"
                    } else {
                        // Commande simple -> prompt court
                        "$fastSystemPrompt \"$userCommand\""
                    }

                    val response = llamaRepository.getResponse(prompt)
                    parseAIResponse(response)
                }

                val result = aiResult ?: CommandResult(
                    success = false,
                    message = "AI timeout - using fallback",
                    actions = listOf(AccessibilityAction.Screenshot)
                )

                COMMAND_CACHE[normalizedCommand] = result
                Log.d(TAG, "✅ Total time: ${System.currentTimeMillis() - startTime}ms")

                result

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error: ${e.message}", e)
                CommandResult(false, "Error: ${e.message}")
            }
        }
    }

    // Traitement local optimisé pour commandes communes
    private fun processLocallyOptimized(command: String): CommandResult? {
        return when {
            // === SITES WEB AVEC RECHERCHE AUTOMATIQUE ===
            command.contains("amtrak") -> {
                CommandResult(
                    success = true,
                    message = "Opening amtrak website",
                    actions = listOf(
                        AccessibilityAction.GoHome,
                        AccessibilityAction.Wait(300),
                        AccessibilityAction.OpenApp("com.android.chrome"),
                        AccessibilityAction.Wait(2000),
                        AccessibilityAction.ClickOnText("Search or type URL"),
                        AccessibilityAction.Wait(500),
                        AccessibilityAction.Type("www.amtrak.com"),
                        AccessibilityAction.Wait(300),
                        AccessibilityAction.PressEnter // CRUCIAL: Appuyer sur Entrée!
                    )
                )
            }

            command.contains("google") || command.contains("search") || command.contains("recherche") -> {
                CommandResult(
                    success = true,
                    message = "Opening Google",
                    actions = listOf(
                        AccessibilityAction.GoHome,
                        AccessibilityAction.Wait(300),
                        AccessibilityAction.OpenApp("com.android.chrome"),
                        AccessibilityAction.Wait(2000),
                        AccessibilityAction.ClickOnText("Search or type URL"),
                        AccessibilityAction.Wait(500),
                        AccessibilityAction.Type("google.com"),
                        AccessibilityAction.Wait(300),
                        AccessibilityAction.PressEnter
                    )
                )
            }


           //
            // Navigation web générique
            command.contains("website") || command.contains("site") || command.contains(".com") || command.contains(".ma") -> {
                val url = extractUrl(command) ?: "google.com"
                CommandResult(
                    success = true,
                    message = "Opening $url",
                    actions = listOf(
                        AccessibilityAction.GoHome,
                        AccessibilityAction.Wait(300),
                        AccessibilityAction.OpenApp("com.android.chrome"),
                        AccessibilityAction.Wait(2000),
                        AccessibilityAction.ClickOnText("Search or type URL"),
                        AccessibilityAction.Wait(500),
                        AccessibilityAction.Type(url),
                        AccessibilityAction.Wait(300),
                        AccessibilityAction.PressEnter
                    )
                )
            }

            // Apps communes
            command.contains("youtube") -> quickOpenApp("com.google.android.youtube", "YouTube")
            command.contains("whatsapp") -> quickOpenApp("com.whatsapp", "WhatsApp")
            command.contains("calculator") || command.contains("calculat") -> quickOpenApp("com.android.calculator2", "Calculator")
            command.contains("camera") || command.contains("photo") -> quickOpenApp("com.android.camera2", "Camera")
            command.contains("settings") || command.contains("paramètre") -> quickOpenApp("com.android.settings", "Settings")

            // Actions système
            command.contains("notification") -> {
                CommandResult(
                    success = true,
                    message = "Opening notifications",
                    actions = listOf(AccessibilityAction.OpenNotifications)
                )
            }

            // Alarmes
            command.contains("alarm") || command.contains("réveil") || command.contains("clock") -> {
                val hour = extractNumber(command) ?: 6
                CommandResult(
                    success = true,
                    message = "Setting alarm for $hour:00",
                    actions = listOf(AccessibilityAction.SetAlarm(hour, 0))
                )
            }

            else -> null
        }
    }

    private fun quickOpenApp(packageName: String, appName: String): CommandResult {
        return CommandResult(
            success = true,
            message = "Opening $appName",
            actions = listOf(
                AccessibilityAction.GoHome,
                AccessibilityAction.Wait(200),
                AccessibilityAction.OpenApp(packageName)
            )
        )
    }

    private fun extractUrl(command: String): String? {
        // Extraire l'URL de la commande
        val patterns = listOf(
            Regex("(www\\.[a-zA-Z0-9-]+\\.[a-z]{2,})"),
            Regex("([a-zA-Z0-9-]+\\.(com|org|net|ma|fr|io))"),
            Regex("https?://[a-zA-Z0-9-]+\\.[a-z]{2,}")
        )

        for (pattern in patterns) {
            val match = pattern.find(command)
            if (match != null) {
                return match.value
            }
        }
        return null
    }

    private fun extractNumber(command: String): Int? {
        val regex = Regex("(\\d{1,2})")
        val match = regex.find(command)
        return match?.groupValues?.get(1)?.toIntOrNull()
    }

    // Parser optimisé pour les réponses IA
    private fun parseAIResponse(jsonString: String): CommandResult {
        return try {
            Log.d(TAG, "🔍 Parsing AI response...")

            // Essayer le format simple d'abord
            val simpleResult = trySimpleFormat(jsonString)
            if (simpleResult != null) {
                // Ajouter PressEnter après Type si nécessaire
                return fixBrowserActions(simpleResult)
            }

            // Extraction JSON rapide
            val jsonStart = jsonString.indexOf('{')
            val jsonEnd = jsonString.lastIndexOf('}')

            if (jsonStart == -1 || jsonEnd == -1) {
                return analyzeTextAndCreateActions(jsonString)
            }

            val extracted = jsonString.substring(jsonStart, jsonEnd + 1)

            // Parser avec la bibliothèque JSON
            val jsonElement = json.parseToJsonElement(extracted)
            val jsonObject = jsonElement.jsonObject

            val success = jsonObject["success"]?.jsonPrimitive?.boolean ?: true
            val message = jsonObject["message"]?.jsonPrimitive?.content ?: "Executing actions"

            val actionsArray = jsonObject["actions"]?.jsonArray
            val actions = actionsArray?.mapNotNull { actionElement ->
                parseAction(actionElement.jsonObject)
            } ?: emptyList()

            val result = CommandResult(success, message, actions)

            // Fix pour les actions de navigateur
            fixBrowserActions(result)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Parse error: ${e.message}")
            analyzeTextAndCreateActions(jsonString)
        }
    }

    // Corriger les actions de navigateur pour ajouter PressEnter
    private fun fixBrowserActions(result: CommandResult): CommandResult {
        val fixedActions = mutableListOf<AccessibilityAction>()
        var lastWasType = false
        var lastTypeWasUrl = false

        for (action in result.actions) {
            fixedActions.add(action)

            if (action is AccessibilityAction.Type) {
                lastWasType = true
                lastTypeWasUrl = action.text.contains(".com") ||
                        action.text.contains(".ma") ||
                        action.text.contains("www") ||
                        action.text.contains("http")
            } else {
                if (lastWasType && lastTypeWasUrl) {
                    // Si la dernière action était Type avec une URL et qu'on n'a pas PressEnter après
                    if (action !is AccessibilityAction.PressEnter &&
                        action !is AccessibilityAction.ClickOnText) {
                        // Insérer PressEnter avant l'action courante
                        fixedActions.add(fixedActions.size - 1, AccessibilityAction.PressEnter)
                    }
                }
                lastWasType = false
                lastTypeWasUrl = false
            }
        }

        // Si la dernière action était Type avec URL, ajouter PressEnter à la fin
        if (lastWasType && lastTypeWasUrl) {
            fixedActions.add(AccessibilityAction.PressEnter)
        }

        return result.copy(actions = fixedActions)
    }

    private fun parseAction(actionObj: JsonObject): AccessibilityAction? {
        return try {
            val type = actionObj["type"]?.jsonPrimitive?.content ?: return null

            when (type) {
                "Click" -> {
                    val x = actionObj["x"]?.jsonPrimitive?.int ?: 540
                    val y = actionObj["y"]?.jsonPrimitive?.int ?: 960
                    AccessibilityAction.Click(x, y)
                }
                "ClickOnText" -> {
                    val text = actionObj["text"]?.jsonPrimitive?.content ?: return null
                    AccessibilityAction.ClickOnText(text)
                }
                "Type" -> {
                    val text = actionObj["text"]?.jsonPrimitive?.content ?: return null
                    AccessibilityAction.Type(text)
                }
                "PressEnter" -> AccessibilityAction.PressEnter
                "Scroll" -> {
                    val direction = actionObj["direction"]?.jsonPrimitive?.content?.uppercase() ?: "DOWN"
                    AccessibilityAction.Scroll(ScrollDirection.valueOf(direction))
                }
                "Screenshot" -> AccessibilityAction.Screenshot
                "GoBack" -> AccessibilityAction.GoBack
                "GoHome" -> AccessibilityAction.GoHome
                "OpenNotifications" -> AccessibilityAction.OpenNotifications
                "Wait" -> {
                    val ms = actionObj["milliseconds"]?.jsonPrimitive?.long ?: 1000L
                    AccessibilityAction.Wait(ms)
                }
                "OpenApp" -> {
                    val packageName = actionObj["packageName"]?.jsonPrimitive?.content ?: return null
                    AccessibilityAction.OpenApp(packageName)
                }
                "SetAlarm" -> {
                    val hour = actionObj["hour"]?.jsonPrimitive?.int ?: 6
                    val minute = actionObj["minute"]?.jsonPrimitive?.int ?: 0
                    AccessibilityAction.SetAlarm(hour, minute)
                }
                else -> {
                    Log.w(TAG, "Unknown action type: $type")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing action: ${e.message}")
            null
        }
    }

    private fun trySimpleFormat(jsonString: String): CommandResult? {
        return try {
            val aiResponse = json.decodeFromString<AIResponse>(jsonString)
            val actions = aiResponse.actions.mapNotNull { convertToAccessibilityAction(it) }

            CommandResult(
                success = aiResponse.success,
                message = aiResponse.message,
                actions = actions
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun convertToAccessibilityAction(actionData: ActionData): AccessibilityAction? {
        return try {
            when (actionData.type) {
                "Click" -> {
                    val x = actionData.x ?: 540
                    val y = actionData.y ?: 960
                    AccessibilityAction.Click(x, y)
                }
                "ClickOnText" -> {
                    actionData.text?.let { AccessibilityAction.ClickOnText(it) }
                }
                "Scroll" -> {
                    val direction = when (actionData.direction?.uppercase()) {
                        "UP" -> ScrollDirection.UP
                        "DOWN" -> ScrollDirection.DOWN
                        "LEFT" -> ScrollDirection.LEFT
                        "RIGHT" -> ScrollDirection.RIGHT
                        else -> ScrollDirection.DOWN
                    }
                    AccessibilityAction.Scroll(direction)
                }
                "Type" -> {
                    actionData.text?.let { AccessibilityAction.Type(it) }
                }
                "PressEnter" -> AccessibilityAction.PressEnter
                "Screenshot" -> AccessibilityAction.Screenshot
                "GoBack" -> AccessibilityAction.GoBack
                "GoHome" -> AccessibilityAction.GoHome
                "OpenNotifications" -> AccessibilityAction.OpenNotifications
                "Wait" -> AccessibilityAction.Wait(actionData.milliseconds ?: 1000)
                "OpenApp" -> {
                    actionData.packageName?.let { AccessibilityAction.OpenApp(it) }
                }
                "SetAlarm" -> {
                    val hour = actionData.hour ?: 6
                    val minute = actionData.minute ?: 0
                    AccessibilityAction.SetAlarm(hour, minute)
                }
                else -> {
                    Log.w(TAG, "Unknown action: ${actionData.type}")
                    null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error converting action: ${e.message}")
            null
        }
    }

    private fun analyzeTextAndCreateActions(text: String): CommandResult {
        Log.d(TAG, "🔄 Fallback text analysis")

        val lower = text.lowercase()

        return when {
            lower.contains("screenshot") -> {
                CommandResult(true, "Taking screenshot", listOf(AccessibilityAction.Screenshot))
            }
            lower.contains("browser") || lower.contains("website") -> {
                CommandResult(
                    true,
                    "Opening browser",
                    listOf(
                        AccessibilityAction.GoHome,
                        AccessibilityAction.Wait(500),
                        AccessibilityAction.OpenApp("com.android.chrome"),
                        AccessibilityAction.Wait(2000)
                    )
                )
            }
            else -> {
                CommandResult(true, "Taking screenshot for analysis", listOf(AccessibilityAction.Screenshot))
            }
        }
    }

    // Fonction pour obtenir un nom de package fiable
    private fun getReliablePackageName(appType: String): String {
        return when (appType.lowercase()) {
            "browser", "chrome" -> {
                val browserPackages = listOf(
                    "com.android.chrome",
                    "com.google.android.googlequicksearchbox",
                    "com.android.browser"
                )
                VoiceAssistantAccessibilityService.instance?.findInstalledPackage(browserPackages)
                    ?: "com.android.chrome"
            }
            "calculator" -> {
                val calcPackages = listOf(
                    "com.google.android.calculator2",
                    "com.android.calculator2",
                    "com.samsung.android.calculator"
                )
                VoiceAssistantAccessibilityService.instance?.findInstalledPackage(calcPackages)
                    ?: "com.android.calculator2"
            }
            else -> "com.android.settings"
        }
    }
}