// Hada dyal Bilal

package com.voiceassistant.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.provider.AlarmClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.*
import com.voiceassistant.model.*
import java.util.*
import android.os.Build
import androidx.annotation.RequiresApi

class VoiceAssistantAccessibilityService : AccessibilityService(), TextToSpeech.OnInitListener {

    private lateinit var textToSpeech: TextToSpeech
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    companion object {
        var instance: VoiceAssistantAccessibilityService? = null
        private const val TAG = "AutoclickService"
    }

    override fun onCreate() {
        super.onCreate()
        textToSpeech = TextToSpeech(this, this)
        Log.d(TAG, "Service d'accessibilité créé")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this

        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                    AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 100
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        }
        serviceInfo = info

        Log.d(TAG, "Service connecté avec nouvelle config serviceInfo")

        // Débugger les navigateurs installés au démarrage
        debugInstalledBrowsers()
    }

    // Nouvelle méthode pour trouver le navigateur installé
    private fun findInstalledBrowser(): String? {
        val browsers = listOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.opera.browser",
            "com.microsoft.emmx",
            "com.brave.browser",
            "com.kiwibrowser.browser",
            "com.sec.android.app.sbrowser", // Samsung Internet
            "com.google.android.googlequicksearchbox" // Google app avec navigateur intégré
        )

        for (browser in browsers) {
            try {
                packageManager.getPackageInfo(browser, 0)
                Log.d(TAG, "✅ Navigateur trouvé: $browser")
                return browser
            } catch (e: Exception) {
                // Continue la recherche
            }
        }

        // Dernière tentative : chercher n'importe quelle app avec "browser" dans le nom
        val allApps = packageManager.getInstalledApplications(0)
        val browserApp = allApps.find {
            it.packageName.contains("browser", ignoreCase = true) ||
                    packageManager.getApplicationLabel(it).toString().contains("browser", ignoreCase = true)
        }

        return browserApp?.packageName
    }

    // Méthode pour ouvrir une URL dans n'importe quel navigateur disponible
    private fun openUrlInAnyBrowser(url: String): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = android.net.Uri.parse(if (url.startsWith("http")) url else "https://$url")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            Log.d(TAG, "✅ URL ouverte avec l'intent ACTION_VIEW: $url")
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Impossible d'ouvrir l'URL: ${e.message}")

            // Fallback: essayer d'ouvrir Google app
            try {
                val googleIntent = Intent(Intent.ACTION_WEB_SEARCH).apply {
                    putExtra("query", url)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(googleIntent)
                Log.d(TAG, "✅ Recherche lancée avec Google")
                true
            } catch (e2: Exception) {
                Log.e(TAG, "❌ Impossible de lancer la recherche: ${e2.message}")
                false
            }
        }
    }

    // Débugger les navigateurs installés
    private fun debugInstalledBrowsers() {
        Log.d(TAG, "🔍 RECHERCHE DES NAVIGATEURS INSTALLÉS...")

        val commonBrowsers = listOf(
            "com.android.chrome" to "Chrome",
            "org.mozilla.firefox" to "Firefox",
            "com.opera.browser" to "Opera",
            "com.microsoft.emmx" to "Edge",
            "com.brave.browser" to "Brave",
            "com.sec.android.app.sbrowser" to "Samsung Internet",
            "com.google.android.googlequicksearchbox" to "Google App"
        )

        for ((pkg, name) in commonBrowsers) {
            try {
                packageManager.getPackageInfo(pkg, 0)
                Log.d(TAG, "✅ $name installé: $pkg")
            } catch (e: Exception) {
                Log.d(TAG, "❌ $name non trouvé")
            }
        }

        // Lister TOUTES les apps avec "browser" ou "internet" dans le nom
        val allApps = packageManager.getInstalledApplications(0)
        val webApps = allApps.filter {
            val label = packageManager.getApplicationLabel(it).toString().lowercase()
            val pkg = it.packageName.lowercase()
            label.contains("browser") || label.contains("internet") ||
                    label.contains("web") || pkg.contains("browser") ||
                    pkg.contains("chrome") || pkg.contains("firefox")
        }

        Log.d(TAG, "📱 APPS WEB TROUVÉES:")
        webApps.forEach { appInfo ->
            val label = packageManager.getApplicationLabel(appInfo)
            Log.d(TAG, "   - $label (${appInfo.packageName})")
        }
    }

    suspend fun executeActionSequence(sequence: ActionSequence): Boolean {
        return withContext(Dispatchers.Main) {
            Log.d(TAG, "🎯 EXECUTING SEQUENCE: ${sequence.description}")
            Log.d(TAG, "📋 Total actions: ${sequence.actions.size}")

            sequence.actions.forEachIndexed { index, action ->
                Log.d(TAG, "   Action ${index + 1}: $action")
            }

            speakText("Exécution de ${sequence.actions.size} actions...")

            var allSuccess = true
            var actionIndex = 0

            for (action in sequence.actions) {
                actionIndex++
                Log.d(TAG, "🔄 EXECUTING Action $actionIndex/${sequence.actions.size}: $action")

                try {
                    val success = when (action) {
                        is AccessibilityAction.Wait -> {
                            Log.d(TAG, "⏱️ Waiting ${action.milliseconds}ms")
                            delay(action.milliseconds)
                            true
                        }

                        is AccessibilityAction.OpenApp -> {
                            Log.d(TAG, "📱 Opening app: ${action.packageName}")

                            // Traitement spécial pour les navigateurs
                            if (action.packageName.contains("chrome") ||
                                action.packageName.contains("browser")) {

                                Log.d(TAG, "🌐 Détection d'une demande de navigateur")

                                // Option 1: Essayer d'ouvrir google.com directement
                                val browserOpened = openUrlInAnyBrowser("google.com")

                                if (!browserOpened) {
                                    // Option 2: Chercher un navigateur installé
                                    val browser = findInstalledBrowser()
                                    if (browser != null) {
                                        Log.d(TAG, "🌐 Ouverture du navigateur trouvé: $browser")
                                        openAppWithDelay(browser)
                                    } else {
                                        Log.e(TAG, "❌ Aucun navigateur trouvé!")
                                        false
                                    }
                                } else {
                                    delay(4000) // Attendre que le navigateur charge
                                    true
                                }
                            }
                            // Traitement spécial pour les apps d'alarme
                            else if (action.packageName.contains("deskclock") ||
                                action.packageName.contains("clock")) {
                                Log.d(TAG, "⏰ Alarm app detected, using AlarmClock API")
                                openClockOrSetAlarm(6, 0)
                            }
                            else {
                                val result = openAppWithDelay(action.packageName)
                                if (result) {
                                    Log.d(TAG, "✅ App opened, waiting for load...")
                                    delay(4000)
                                } else {
                                    Log.e(TAG, "❌ Failed to open app: ${action.packageName}")
                                }
                                result
                            }
                        }

                        is AccessibilityAction.SetAlarm -> {
                            Log.d(TAG, "⏰ Setting alarm directly: ${action.hour}:${action.minute}")
                            openClockOrSetAlarm(action.hour, action.minute)
                        }

                        is AccessibilityAction.GoHome -> {
                            Log.d(TAG, "🏠 Going home")
                            performGlobalAction(GLOBAL_ACTION_HOME)
                        }

                        is AccessibilityAction.Screenshot -> {
                            Log.d(TAG, "📸 Taking screenshot")
                            performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                        }

                        is AccessibilityAction.ClickOnText -> {
                            Log.d(TAG, "👆 Clicking on text: ${action.text}")
                            delay(1000)

                            // Pour la recherche Google, essayer différentes variations
                            val clicked = when {
                                action.text.contains("Search", ignoreCase = true) ||
                                        action.text.contains("URL", ignoreCase = true) -> {
                                    // Essayer de cliquer sur la barre de recherche Google
                                    clickOnSearchBar() ||
                                            clickOnTextElement(action.text) ||
                                            clickOnPartialTextElement("Search") ||
                                            clickOnPartialTextElement("Rechercher") ||
                                            clickOnDescriptionElement("Search")
                                }
                                action.text.equals("Go", ignoreCase = true) -> {
                                    // Essayer de soumettre la recherche
                                    performEnterKey() ||
                                            clickOnTextElement(action.text) ||
                                            clickOnPartialTextElement("Search") ||
                                            clickOnDescriptionElement("Search")
                                }
                                else -> {
                                    clickOnTextElement(action.text) ||
                                            clickOnPartialTextElement(action.text) ||
                                            clickOnDescriptionElement(action.text)
                                }
                            }
                            clicked
                        }

                        is AccessibilityAction.Type -> {
                            Log.d(TAG, "⌨️ Typing: ${action.text}")
                            delay(500)

                            // Essayer de taper dans le champ actif
                            val typed = typeTextInField(action.text) ||
                                    typeInFocusedField(action.text)

                            if (!typed && action.text.contains(".com")) {
                                // Si c'est une URL et qu'on ne peut pas taper,
                                // essayer d'ouvrir directement
                                Log.d(TAG, "💡 Tentative d'ouverture directe de l'URL: ${action.text}")
                                openUrlInAnyBrowser(action.text)
                            } else {
                                typed
                            }
                        }
                        is AccessibilityAction.PressEnter -> {
                            Log.d(TAG, "⏎ Pressing Enter key")
                            pressEnterKey()
                        }

                        else -> {
                            executeActionSync(action)
                        }
                    }

                    if (!success) {
                        allSuccess = false
                        Log.e(TAG, "❌ FAILED Action $actionIndex: $action")
                    } else {
                        Log.d(TAG, "✅ SUCCESS Action $actionIndex: $action")
                    }

                    delay(800)

                } catch (e: Exception) {
                    Log.e(TAG, "❌ EXCEPTION Action $actionIndex: ${e.message}", e)
                    allSuccess = false
                }
            }

            val resultMessage = if (allSuccess) {
                "✅ Toutes les ${sequence.actions.size} actions réussies"
            } else {
                "⚠️ Certaines actions ont échoué, mais j'ai essayé d'accomplir la tâche"
            }

            Log.d(TAG, "🏁 SEQUENCE COMPLETED: $resultMessage")
            speakText(resultMessage)

            allSuccess
        }
    }

    // Nouvelle méthode pour cliquer sur la barre de recherche
    private fun clickOnSearchBar(): Boolean {
        val rootNode = rootInActiveWindow ?: return false

        // Chercher un EditText ou un champ de recherche
        val searchField = findSearchField(rootNode)

        return searchField?.let { node ->
            Log.d(TAG, "📍 Barre de recherche trouvée: ${node.className}")
            performClickOnNode(node)
        } ?: false
    }

    // Chercher un champ de recherche
    private fun findSearchField(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        try {
            // C'est un champ de recherche ?
            if (root.className == "android.widget.EditText" ||
                root.className?.contains("SearchBox") == true ||
                root.className?.contains("UrlBar") == true ||
                root.contentDescription?.contains("search", ignoreCase = true) == true ||
                root.text?.toString()?.contains("search", ignoreCase = true) == true) {
                return root
            }

            // Recherche récursive
            for (i in 0 until root.childCount) {
                root.getChild(i)?.let { child ->
                    val result = findSearchField(child)
                    if (result != null) return result
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur recherche champ: ${e.message}")
        }
        return null
    }

    // Taper dans le champ avec le focus
    private fun typeInFocusedField(text: String): Boolean {
        return try {
            val rootNode = rootInActiveWindow ?: return false

            // Trouver le nœud avec le focus
            val focusedNode = rootNode.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)

            if (focusedNode != null) {
                Log.d(TAG, "✅ Champ avec focus trouvé")
                val arguments = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
                }
                focusedNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur saisie dans champ focus: ${e.message}")
            false
        }
    }

    // Simuler la touche Entrée
    private fun performEnterKey(): Boolean {
        return try {
            performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT) // Temporaire, juste pour tester
            // Dans un vrai cas, vous devriez envoyer un KeyEvent.KEYCODE_ENTER
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun openClockOrSetAlarm(hour: Int = 6, minutes: Int = 0): Boolean {
        return try {
            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour)
                putExtra(AlarmClock.EXTRA_MINUTES, minutes)
                putExtra(AlarmClock.EXTRA_MESSAGE, "Réveil Auralia")
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Impossible d'ouvrir l'horloge: ${e.message}", e)
            false
        }
    }

    // ... [Garder toutes les autres méthodes existantes comme onAccessibilityEvent, handleNotification, etc.]

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let { accessibilityEvent ->
            when (accessibilityEvent.eventType) {
                AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED -> {
                    handleNotification(accessibilityEvent)
                }
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    handleWindowChange(accessibilityEvent)
                }
                AccessibilityEvent.TYPE_VIEW_FOCUSED -> {
                    handleViewFocus(accessibilityEvent)
                }
            }
        }
    }

    private fun handleNotification(event: AccessibilityEvent) {
        val notification = event.text?.joinToString(" ") ?: return
        if (notification.isNotEmpty()) {
            Log.d(TAG, "Notification: $notification")
        }
    }

    private fun handleWindowChange(event: AccessibilityEvent) {
        val packageName = event.packageName?.toString() ?: return
        if (packageName != "com.voiceassistant") {
            val appName = getAppName(packageName)
            Log.d(TAG, "App changée: $appName")
        }
    }

    private fun handleViewFocus(event: AccessibilityEvent) {
        val focusedText = event.text?.joinToString(" ")
        if (!focusedText.isNullOrEmpty() && focusedText.length < 30) {
            Log.d(TAG, "Focus: $focusedText")
        }
    }

    private fun getAppName(packageName: String): String {
        return try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }
    }

    // [Conserver toutes les autres méthodes existantes...]

    fun executeGenericCommand(command: String): Boolean {
        Log.d(TAG, "🎯 Commande reçue: '$command'")
        val normalizedCommand = command.lowercase().trim()

        return try {
            when {
                normalizedCommand.contains("test simple") -> {
                    Log.d(TAG, "Test simple réussi")
                    speakText("Test de connexion réussi")
                    true
                }
                normalizedCommand.matches(Regex(".*clique?\\s+(?:à|at)\\s+(\\d+)\\s*[,\\s]\\s*(\\d+).*")) -> {
                    handleClickAtCoordinates(normalizedCommand)
                }
                normalizedCommand.matches(Regex(".*clique?\\s+sur\\s+(.+)")) ||
                        normalizedCommand.matches(Regex(".*click\\s+on\\s+(.+)")) -> {
                    handleClickOnText(normalizedCommand)
                }
                normalizedCommand.matches(Regex(".*(?:tape|type)\\s+['\"](.+)['\"].*")) -> {
                    handleTypeText(normalizedCommand)
                }
                normalizedCommand.contains("scroll") || normalizedCommand.contains("défil") -> {
                    handleScroll(normalizedCommand)
                }
                normalizedCommand.contains("retour") || normalizedCommand.contains("back") -> {
                    handleGoBack()
                }
                normalizedCommand.contains("accueil") || normalizedCommand.contains("home") -> {
                    handleGoHome()
                }
                normalizedCommand.contains("screenshot") || normalizedCommand.contains("capture") -> {
                    handleTakeScreenshot()
                }
                normalizedCommand.contains("notification") -> {
                    handleOpenNotifications()
                }
                else -> {
                    Log.w(TAG, "Commande non reconnue: $command")
                    speakText("Commande non reconnue")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur: ${e.message}", e)
            speakText("Erreur lors de l'exécution")
            false
        }
    }

    private fun handleClickAtCoordinates(command: String): Boolean {
        val regex = Regex(".*clique?\\s+(?:à|at)\\s+(\\d+)\\s*[,\\s]\\s*(\\d+).*")
        val match = regex.find(command)

        return if (match != null) {
            val x = match.groupValues[1].toFloat()
            val y = match.groupValues[2].toFloat()

            Log.d(TAG, "Clic aux coordonnées: ($x, $y)")
            val success = performClickAtCoordinates(x, y)

            if (success) {
                speakText("Clic effectué à $x, $y")
                Log.d(TAG, "Clic par coordonnées réussi")
            } else {
                speakText("Échec du clic aux coordonnées")
                Log.e(TAG, "Échec du clic par coordonnées")
            }
            success
        } else {
            speakText("Format de coordonnées invalide")
            false
        }
    }

    private fun handleClickOnText(command: String): Boolean {
        val regexFr = Regex(".*clique?\\s+sur\\s+(.+)")
        val regexEn = Regex(".*click\\s+on\\s+(.+)")

        val match = regexFr.find(command) ?: regexEn.find(command)

        return if (match != null) {
            val targetText = match.groupValues[1].trim()
            Log.d(TAG, "Recherche élément avec texte: '$targetText'")

            val success = clickOnTextElement(targetText) ||
                    clickOnDescriptionElement(targetText) ||
                    clickOnPartialTextElement(targetText)

            if (success) {
                speakText("Clic effectué sur $targetText")
                Log.d(TAG, "Clic par texte réussi: $targetText")
            } else {
                speakText("Élément '$targetText' non trouvé")
                Log.w(TAG, "Élément non trouvé: $targetText")
                listAvailableElements()
            }
            success
        } else {
            speakText("Format de commande invalide")
            false
        }
    }

    private fun handleTypeText(command: String): Boolean {
        val regex = Regex(".*(?:tape|type)\\s+['\"](.+)['\"].*")
        val match = regex.find(command)

        return if (match != null) {
            val textToType = match.groupValues[1]
            Log.d(TAG, "Saisie texte: '$textToType'")

            val success = typeTextInField(textToType)

            if (success) {
                speakText("Texte saisi: $textToType")
                Log.d(TAG, "Saisie de texte réussie")
            } else {
                speakText("Aucun champ de saisie trouvé")
                Log.w(TAG, "Aucun champ de saisie disponible")
            }
            success
        } else {
            speakText("Format de texte invalide")
            false
        }
    }

    private fun handleScroll(command: String): Boolean {
        val direction = when {
            command.contains("up") || command.contains("haut") -> "UP"
            command.contains("down") || command.contains("bas") -> "DOWN"
            command.contains("left") || command.contains("gauche") -> "LEFT"
            command.contains("right") || command.contains("droite") -> "RIGHT"
            else -> "DOWN"
        }

        Log.d(TAG, "Défilement vers: $direction")
        val success = performScroll(direction)

        if (success) {
            speakText("Défilement $direction effectué")
            Log.d(TAG, "Défilement réussi: $direction")
        } else {
            speakText("Échec du défilement")
            Log.w(TAG, "Échec du défilement: $direction")
        }

        return success
    }

    private fun handleGoBack(): Boolean {
        Log.d(TAG, "Exécution: Retour système")
        val success = performGlobalAction(GLOBAL_ACTION_BACK)

        if (success) {
            speakText("Retour effectué")
            Log.d(TAG, "Action retour réussie")
        } else {
            speakText("Échec du retour")
            Log.w(TAG, "Échec action retour")
        }

        return success
    }

    private fun handleGoHome(): Boolean {
        Log.d(TAG, "Exécution: Accueil système")
        val success = performGlobalAction(GLOBAL_ACTION_HOME)

        if (success) {
            speakText("Retour à l'accueil")
            Log.d(TAG, "Action accueil réussie")
        } else {
            speakText("Échec retour accueil")
            Log.w(TAG, "Échec action accueil")
        }

        return success
    }

    private fun handleTakeScreenshot(): Boolean {
        Log.d(TAG, "Exécution: Capture d'écran")
        val success = performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)

        if (success) {
            speakText("Capture d'écran prise")
            Log.d(TAG, "Capture d'écran réussie")
        } else {
            speakText("Échec de la capture")
            Log.w(TAG, "Échec capture d'écran")
        }

        return success
    }

    private fun handleOpenNotifications(): Boolean {
        Log.d(TAG, "Exécution: Ouverture notifications")
        val success = performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)

        if (success) {
            speakText("Notifications ouvertes")
            Log.d(TAG, "Ouverture notifications réussie")
        } else {
            speakText("Échec ouverture notifications")
            Log.w(TAG, "Échec ouverture notifications")
        }

        return success
    }

    private fun performClickAtCoordinates(x: Float, y: Float): Boolean {
        return try {
            val path = Path().apply { moveTo(x, y) }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
                .build()

            dispatchGesture(gesture, null, null)
        } catch (e: Exception) {
            Log.e(TAG, "Erreur clic coordonnées: ${e.message}")
            false
        }
    }

    private fun clickOnTextElement(text: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val targetNode = findNodeByExactText(rootNode, text)

        return targetNode?.let { node ->
            Log.d(TAG, "Élément trouvé par texte exact: '${node.text}'")
            performClickOnNode(node)
        } ?: false
    }

    private fun clickOnDescriptionElement(description: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val targetNode = findNodeByContentDescription(rootNode, description)

        return targetNode?.let { node ->
            Log.d(TAG, "Élément trouvé par description: '${node.contentDescription}'")
            performClickOnNode(node)
        } ?: false
    }

    private fun clickOnPartialTextElement(partialText: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val targetNode = findNodeByPartialText(rootNode, partialText)

        return targetNode?.let { node ->
            Log.d(TAG, "Élément trouvé par texte partiel: '${node.text}'")
            performClickOnNode(node)
        } ?: false
    }

    private fun performClickOnNode(node: AccessibilityNodeInfo): Boolean {
        return try {
            if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                Log.d(TAG, "Clic direct sur nœud réussi")
                return true
            }

            val rect = Rect()
            node.getBoundsInScreen(rect)

            if (!rect.isEmpty) {
                val centerX = rect.centerX().toFloat()
                val centerY = rect.centerY().toFloat()
                Log.d(TAG, "Clic par coordonnées nœud: ($centerX, $centerY)")
                return performClickAtCoordinates(centerX, centerY)
            }

            Log.w(TAG, "Impossible de cliquer sur le nœud")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Erreur clic sur nœud: ${e.message}")
            false
        }
    }

    private fun typeTextInField(text: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        val editText = findEditTextField(rootNode)

        return editText?.let { node ->
            try {
                Log.d(TAG, "Champ de saisie trouvé: ${node.className}")
                val arguments = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
                }
                node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
            } catch (e: Exception) {
                Log.e(TAG, "Erreur saisie texte: ${e.message}")
                false
            }
        } ?: false
    }

    private fun performScroll(direction: String): Boolean {
        return try {
            val displayMetrics = resources.displayMetrics
            val screenWidth = displayMetrics.widthPixels.toFloat()
            val screenHeight = displayMetrics.heightPixels.toFloat()

            val path = Path()

            when (direction) {
                "UP" -> {
                    path.moveTo(screenWidth / 2, screenHeight * 0.8f)
                    path.lineTo(screenWidth / 2, screenHeight * 0.2f)
                }
                "DOWN" -> {
                    path.moveTo(screenWidth / 2, screenHeight * 0.2f)
                    path.lineTo(screenWidth / 2, screenHeight * 0.8f)
                }
                "LEFT" -> {
                    path.moveTo(screenWidth * 0.8f, screenHeight / 2)
                    path.lineTo(screenWidth * 0.2f, screenHeight / 2)
                }
                "RIGHT" -> {
                    path.moveTo(screenWidth * 0.2f, screenHeight / 2)
                    path.lineTo(screenWidth * 0.8f, screenHeight / 2)
                }
            }

            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 500))
                .build()

            dispatchGesture(gesture, null, null)
        } catch (e: Exception) {
            Log.e(TAG, "Erreur défilement: ${e.message}")
            false
        }
    }

    private fun findNodeByExactText(root: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        try {
            if (root.text?.toString()?.equals(text, ignoreCase = true) == true) {
                return root
            }

            for (i in 0 until root.childCount) {
                root.getChild(i)?.let { child ->
                    val result = findNodeByExactText(child, text)
                    if (result != null) return result
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur recherche texte exact: ${e.message}")
        }
        return null
    }

    private fun findNodeByPartialText(root: AccessibilityNodeInfo, partialText: String): AccessibilityNodeInfo? {
        try {
            if (root.text?.toString()?.contains(partialText, ignoreCase = true) == true) {
                return root
            }

            for (i in 0 until root.childCount) {
                root.getChild(i)?.let { child ->
                    val result = findNodeByPartialText(child, partialText)
                    if (result != null) return result
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur recherche texte partiel: ${e.message}")
        }
        return null
    }

    private fun findNodeByContentDescription(root: AccessibilityNodeInfo, description: String): AccessibilityNodeInfo? {
        try {
            if (root.contentDescription?.toString()?.contains(description, ignoreCase = true) == true) {
                return root
            }

            for (i in 0 until root.childCount) {
                root.getChild(i)?.let { child ->
                    val result = findNodeByContentDescription(child, description)
                    if (result != null) return result
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur recherche description: ${e.message}")
        }
        return null
    }

    private fun findEditTextField(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        try {
            if (root.className == "android.widget.EditText" ||
                (root.isFocusable && root.isEditable)) {
                return root
            }

            for (i in 0 until root.childCount) {
                root.getChild(i)?.let { child ->
                    val result = findEditTextField(child)
                    if (result != null) return result
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur recherche champ éditable: ${e.message}")
        }
        return null
    }

    private fun listAvailableElements() {
        try {
            val rootNode = rootInActiveWindow ?: return
            val elements = mutableListOf<String>()

            collectClickableElements(rootNode, elements)

            if (elements.isNotEmpty()) {
                val elementsList = elements.take(5).joinToString(", ")
                Log.d(TAG, "Éléments cliquables disponibles: $elements")
                speakText("Éléments disponibles: $elementsList")
            } else {
                Log.d(TAG, "Aucun élément cliquable trouvé")
                speakText("Aucun élément cliquable visible")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur listing éléments: ${e.message}")
        }
    }

    private fun collectClickableElements(node: AccessibilityNodeInfo, elements: MutableList<String>) {
        try {
            if (node.isClickable) {
                val text = node.text?.toString()
                val description = node.contentDescription?.toString()

                when {
                    !text.isNullOrBlank() -> elements.add("'$text'")
                    !description.isNullOrBlank() -> elements.add("[$description]")
                    else -> elements.add("(Bouton sans texte)")
                }
            }

            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { child ->
                    collectClickableElements(child, elements)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur collection éléments: ${e.message}")
        }
    }

    private fun speakText(text: String) {
        try {
            if (::textToSpeech.isInitialized) {
                textToSpeech.speak(text, TextToSpeech.QUEUE_ADD, null, null)
            }
            Log.d(TAG, "🔊 TTS: $text")
        } catch (e: Exception) {
            Log.e(TAG, "Erreur TTS: ${e.message}")
        }
    }

    private fun executeActionSync(action: AccessibilityAction): Boolean {
        return try {
            when (action) {
                is AccessibilityAction.Click -> {
                    Log.d(TAG, "👆 Clic à (${action.x}, ${action.y})")
                    performClickAtCoordinates(action.x.toFloat(), action.y.toFloat())
                }
                is AccessibilityAction.ClickOnText -> {
                    Log.d(TAG, "👆 Clic sur texte: ${action.text}")
                    clickOnTextElement(action.text) ||
                            clickOnPartialTextElement(action.text) ||
                            clickOnDescriptionElement(action.text)
                }
                is AccessibilityAction.Scroll -> {
                    Log.d(TAG, "📜 Défilement: ${action.direction}")
                    performScroll(action.direction.name)
                }
                is AccessibilityAction.Type -> {
                    Log.d(TAG, "⌨️ Saisie: ${action.text}")
                    typeTextInField(action.text)
                }
                is AccessibilityAction.Screenshot -> {
                    Log.d(TAG, "📸 Capture d'écran")
                    performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                }
                is AccessibilityAction.GoBack -> {
                    Log.d(TAG, "⬅️ Retour")
                    performGlobalAction(GLOBAL_ACTION_BACK)
                }
                is AccessibilityAction.GoHome -> {
                    Log.d(TAG, "🏠 Accueil")
                    performGlobalAction(GLOBAL_ACTION_HOME)
                }
                is AccessibilityAction.OpenNotifications -> {
                    Log.d(TAG, "🔔 Notifications")
                    performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
                }
                is AccessibilityAction.SetAlarm -> {
                    Log.d(TAG, "⏰ Setting alarm: ${action.hour}:${action.minute}")
                    openClockOrSetAlarm(action.hour, action.minute)
                }
                is AccessibilityAction.PressEnter -> {
                    Log.d(TAG, "⏎ Pressing Enter")
                    pressEnterKey()
                }
                else -> false
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Erreur action sync: ${e.message}", e)
            false
        }
    }
    private fun pressEnterKey(): Boolean {
        return try {
            Log.d(TAG, "🔍 Attempting to press Enter...")

            val rootNode = rootInActiveWindow ?: return false

            // Méthode 1: Trouver le champ avec focus et simuler Enter
            val focusedNode = rootNode.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (focusedNode != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val imeEnterId = AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id
                    if (focusedNode.performAction(imeEnterId)) {
                        Log.d(TAG, "✅ Enter via ACTION_IME_ENTER")
                        return true
                    }
                }
            }

            // Méthode 2: Chercher et cliquer sur le bouton de recherche Google
            val searchButtons = listOf(
                "Recherche Google",
                "Rechercher",
                "Search",
                "J'ai de la chance",
                "I'm Feeling Lucky",
                "Lancer la recherche",
                "Go"
            )

            for (buttonText in searchButtons) {
                if (clickOnTextElement(buttonText) ||
                    clickOnPartialTextElement(buttonText) ||
                    clickOnDescriptionElement(buttonText)) {
                    Log.d(TAG, "✅ Clicked on search button: $buttonText")
                    return true
                }
            }

            // Méthode 3: Chercher un bouton avec une icône de recherche
            val searchNode = findSearchButton(rootNode)
            if (searchNode != null) {
                Log.d(TAG, "Found search button by description")
                return performClickOnNode(searchNode)
            }

            // Méthode 4: Simuler un clic sur les coordonnées du bouton Enter du clavier
            // (Position approximative du bouton Enter sur le clavier virtuel)
            val displayMetrics = resources.displayMetrics
            val screenWidth = displayMetrics.widthPixels
            val screenHeight = displayMetrics.heightPixels

            // Le bouton Enter est généralement en bas à droite du clavier
            val enterX = screenWidth * 0.9f
            val enterY = screenHeight * 0.95f

            Log.d(TAG, "Trying to click Enter key at coordinates: ($enterX, $enterY)")
            performClickAtCoordinates(enterX, enterY)

        } catch (e: Exception) {
            Log.e(TAG, "Error pressing Enter: ${e.message}")
            false
        }
    }

    private fun findSearchButton(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        try {
            // Chercher par description
            val descriptions = listOf("search", "recherche", "submit", "go", "enter")

            for (desc in descriptions) {
                if (root.contentDescription?.toString()?.contains(desc, ignoreCase = true) == true) {
                    if (root.isClickable) {
                        return root
                    }
                }
            }

            // Chercher par classe (boutons)
            if (root.className == "android.widget.Button" ||
                root.className == "android.widget.ImageButton") {
                val text = root.text?.toString()?.lowercase() ?: ""
                val desc = root.contentDescription?.toString()?.lowercase() ?: ""

                if (text.contains("search") || text.contains("recherche") ||
                    text.contains("go") || desc.contains("search") ||
                    desc.contains("submit")) {
                    return root
                }
            }

            // Recherche récursive
            for (i in 0 until root.childCount) {
                root.getChild(i)?.let { child ->
                    val result = findSearchButton(child)
                    if (result != null) return result
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error finding search button: ${e.message}")
        }
        return null
    }


    fun findInstalledPackage(packages: List<String>): String? {
        for (packageName in packages) {
            try {
                packageManager.getPackageInfo(packageName, 0)
                Log.d(TAG, "✅ Found installed package: $packageName")
                return packageName
            } catch (e: Exception) {
                Log.d(TAG, "❌ Package not found: $packageName")
            }
        }
        return null
    }

    private suspend fun openAppWithDelay(packageName: String): Boolean {
        return withContext(Dispatchers.Main) {
            try {
                Log.d(TAG, "🚀 ATTEMPTING TO OPEN: $packageName")

                val packageExists = try {
                    packageManager.getPackageInfo(packageName, 0)
                    true
                } catch (e: Exception) {
                    Log.w(TAG, "❌ Package not installed: $packageName")
                    false
                }

                if (!packageExists) {
                    val alternatives = getAlternativePackages(packageName)
                    for (altPackage in alternatives) {
                        Log.d(TAG, "🔄 Trying alternative: $altPackage")
                        if (openAppWithDelay(altPackage)) {
                            return@withContext true
                        }
                    }
                    return@withContext false
                }

                val intent = packageManager.getLaunchIntentForPackage(packageName)
                if (intent == null) {
                    Log.w(TAG, "❌ No launch intent for: $packageName")
                    return@withContext false
                }

                intent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                )

                Log.d(TAG, "🎯 Starting activity with intent: $intent")
                startActivity(intent)

                Log.d(TAG, "✅ Activity started successfully: $packageName")
                return@withContext true

            } catch (e: SecurityException) {
                Log.e(TAG, "❌ SecurityException opening $packageName: ${e.message}")
                return@withContext false
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error opening $packageName: ${e.message}", e)
                return@withContext false
            }
        }
    }

    private fun getAlternativePackages(packageName: String): List<String> {
        return when (packageName) {
            "com.google.android.deskclock" -> listOf(
                "com.android.deskclock",
                "com.samsung.android.app.clockpackage",
                "com.htc.android.worldclock",
                "com.oneplus.deskclock"
            )
            "com.android.chrome" -> listOf(
                "org.mozilla.firefox",
                "com.opera.browser",
                "com.microsoft.emmx",
                "com.brave.browser",
                "com.sec.android.app.sbrowser",
                "com.google.android.googlequicksearchbox",
                "com.android.browser"
            )
            "com.google.android.calculator2" -> listOf(
                "com.android.calculator2",
                "com.samsung.android.calculator"
            )
            else -> emptyList()
        }
    }

    fun debugInstalledApps() {
        Log.d(TAG, "🔍 DEBUGGING: Checking installed apps...")

        val testPackages = listOf(
            "com.google.android.deskclock",
            "com.android.deskclock",
            "com.google.android.calculator2",
            "com.android.calculator2",
            "com.android.chrome",
            "com.google.android.googlequicksearchbox",
            "com.android.settings"
        )

        testPackages.forEach { packageName ->
            try {
                val packageInfo = packageManager.getPackageInfo(packageName, 0)
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                Log.d(TAG, "✅ PACKAGE FOUND: $packageName")
                Log.d(TAG, "   - Version: ${packageInfo.versionName}")
                Log.d(TAG, "   - Launch Intent: ${intent != null}")
            } catch (e: Exception) {
                Log.d(TAG, "❌ PACKAGE NOT FOUND: $packageName")
            }
        }

        val allApps = packageManager.getInstalledApplications(0)
        val clockApps = allApps.filter {
            val label = packageManager.getApplicationLabel(it).toString().lowercase()
            label.contains("clock") || label.contains("alarm") || it.packageName.contains("clock")
        }

        Log.d(TAG, "🕐 CLOCK-RELATED APPS FOUND:")
        clockApps.forEach { appInfo ->
            val label = packageManager.getApplicationLabel(appInfo)
            Log.d(TAG, "   - $label (${appInfo.packageName})")
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech.language = Locale.getDefault()
            textToSpeech.setSpeechRate(0.9f)
            Log.d(TAG, "TextToSpeech initialisé")
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Service interrompu")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        serviceScope.cancel()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            if (::textToSpeech.isInitialized) {
                textToSpeech.stop()
                textToSpeech.shutdown()
            }
            instance = null
            Log.d(TAG, "Service détruit proprement")
        } catch (e: Exception) {
            Log.e(TAG, "Erreur destruction service: ${e.message}")
        }
    }
}