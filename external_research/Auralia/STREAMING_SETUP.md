# Streaming Word by Word - Configuration

## 🎯 Fonctionnalité

L'application analyse les images avec un streaming en temps réel qui affiche la réponse **mot par mot** au fur et à mesure qu'elle arrive du serveur Ollama.

## ⚙️ Configuration

### 1. Serveur Ollama
- Assurez-vous qu'Ollama est en cours d'exécution sur votre serveur
- Le modèle `llava` doit être installé : `ollama pull llava`
- Le serveur doit être accessible depuis votre appareil Android

### 2. Configuration réseau
- IP du serveur : `192.168.1.6:11434` (modifiable dans `OllamaApiClient.kt`)
- URLs alternatives testées automatiquement :
  - `192.168.1.116:11434`
  - `10.0.2.2:11434` (émulateur)
  - `localhost:11434`

## 🔧 Fonctionnement technique

### Streaming avec `stream = true`
```kotlin
val request = OllamaRequest(
    model = "llava",
    prompt = "Que vois-tu sur cette image ?",
    images = listOf(imageBase64),
    stream = true  // ← Activation du streaming
)
```

### Traitement mot par mot
1. **Réception** : Chaque ligne JSON du serveur Ollama
2. **Parsing** : Extraction du champ `response`
3. **Division** : Séparation en mots individuels
4. **Émission** : Chaque mot est émis avec un délai de 100ms
5. **Affichage** : Mise à jour en temps réel de l'interface

### Code de streaming
```kotlin
// Dans OllamaApiClient.kt
val words = newWords.split(" ")
for (word in words) {
    if (word.isNotEmpty()) {
        fullResponse += if (fullResponse.isEmpty()) word else " $word"
        emit(fullResponse)  // Émission de chaque mot
        kotlinx.coroutines.delay(100)  // Délai pour voir les mots
    }
}
```

## 🎨 Interface utilisateur

### Indicateurs visuels
- **"Word by Word"** : Indique que le streaming est actif
- **"Receiving Words..."** : Texte du bouton pendant le streaming
- **"⏳ Receiving words in real-time..."** : Message sous le résultat
- **Spinner animé** : Indicateur de progression

### États de l'interface
1. **Idle** : "Analyze Image" (prêt)
2. **Loading** : "Analyzing..." (traitement initial)
3. **Streaming** : "Receiving Words..." (réception mot par mot)
4. **Complete** : Affichage du résultat final

## 🚀 Utilisation

1. **Ouvrir** l'écran "Image Analysis"
2. **Sélectionner** une image (galerie ou caméra)
3. **Taper** sur "Analyze Image"
4. **Observer** la réponse qui apparaît mot par mot
5. **Attendre** la fin du streaming

## 🔍 Dépannage

### Problème : Pas de streaming
- Vérifiez que `stream = true` dans la requête
- Contrôlez les logs : "Starting to read streaming response word by word"
- Assurez-vous que le serveur Ollama supporte le streaming

### Problème : Mots trop rapides/lents
- Modifiez le délai dans `kotlinx.coroutines.delay(100)`
- 100ms = rapide, 200ms = moyen, 500ms = lent

### Problème : Connexion
- Utilisez le bouton "🔍 Test Connection"
- Vérifiez l'IP du serveur dans `OllamaApiClient.kt`
- Testez avec `curl http://IP:11434/api/tags`

## 📱 Avantages

- **Feedback immédiat** : L'utilisateur voit la réponse se construire
- **Engagement** : Expérience interactive et dynamique
- **Transparence** : Pas d'attente silencieuse
- **Debugging** : Facile de voir où le processus s'arrête

## 🔧 Personnalisation

### Changer la vitesse
```kotlin
// Dans OllamaApiClient.kt, ligne ~95
kotlinx.coroutines.delay(100)  // 100ms entre chaque mot
```

### Changer le prompt
```kotlin
// Dans ImageAnalysisViewModel.kt
fun analyzeImage(context: Context, prompt: String = "Votre prompt personnalisé")
```

### Changer l'IP du serveur
```kotlin
// Dans OllamaApiClient.kt, ligne ~15
private val baseUrl = "http://VOTRE_IP:11434/"
``` 