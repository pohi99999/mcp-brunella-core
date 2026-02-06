// LlamaScreen.kt - Version fusionnée avec exécution cachée
package com.voiceassistant.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.voiceassistant.model.ChatMessage
import com.voiceassistant.viewmodel.LlamaViewModel
import com.voiceassistant.viewmodel.SpeechToTextViewModel
import com.voiceassistant.viewmodel.SpeechToTextEvent
import kotlinx.coroutines.launch
import com.voiceassistant.ai.AIAssistantManager
import android.util.Log

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LlamaScreen(
    onBackClick: () -> Unit = {},
    aiAssistantManager: AIAssistantManager? = null
) {
    val vm: LlamaViewModel = viewModel()
    val sttVm: SpeechToTextViewModel = viewModel()

    val chatMessages by vm.chatMessages.collectAsState()
    val currentResponse by vm.currentResponse.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val useStreaming by vm.useStreaming.collectAsState()
    val selectedModel by vm.selectedModel.collectAsState()

    // STT states
    val isListening by sttVm.isListening.collectAsState()
    val isProcessing by sttVm.isProcessing.collectAsState()
    val transcriptionResult by sttVm.transcriptionResult.collectAsState()
    val sttError by sttVm.error.collectAsState()

    var prompt by remember { mutableStateOf("") }
    var showModelSelector by remember { mutableStateOf(false) }
    var showClearChatDialog by remember { mutableStateOf(false) }
    var showSttConfirmation by remember { mutableStateOf(false) }
    var pendingTranscription by remember { mutableStateOf("") }
    var autoSendStt by remember { mutableStateOf(false) }

    // Mode d'exécution AI (caché mais actif)
    var aiExecutionEnabled by remember { mutableStateOf(true) }
    var isExecutingAI by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    var showScrollToBottom by remember { mutableStateOf(false) }

    // Function to execute AI commands silently in background
    fun executeAICommandSilently(
        command: String,
        manager: AIAssistantManager,
        vm: LlamaViewModel,
        setExecuting: (Boolean) -> Unit
    ) {
        setExecuting(true)
        Log.d("LlamaScreen", "🤖 Executing AI command silently: $command")

        try {
            // Try to use detailed method first
            manager.processVoiceCommandWithDetails(command) { success, message, realJson, realActions ->
                Log.d("LlamaScreen", "AI Result: Success=$success, Message=$message")
                Log.d("LlamaScreen", "AI JSON: $realJson")
                Log.d("LlamaScreen", "AI Actions: ${realActions.joinToString()}")
                setExecuting(false)

                // Optionally add a subtle notification in chat
                if (!success) {
                    vm.addSystemMessage("⚠️ Action failed: $message")
                }
            }
        } catch (e: Exception) {
            // Fallback to simple method
            manager.processVoiceCommand(command) { success, message ->
                Log.d("LlamaScreen", "AI Simple Result: Success=$success, Message=$message")
                setExecuting(false)

                if (!success) {
                    vm.addSystemMessage("⚠️ Action failed: $message")
                }
            }
        }
    }

    // Handle STT events
    LaunchedEffect(Unit) {
        sttVm.events.collect { event ->
            when (event) {
                is SpeechToTextEvent.TranscriptionComplete -> {
                    pendingTranscription = event.transcription
                    if (autoSendStt) {
                        // Auto-send to model directly
                        vm.sendPrompt(event.transcription)
                        // Also execute AI commands if enabled
                        if (aiExecutionEnabled && aiAssistantManager != null) {
                            executeAICommandSilently(
                                event.transcription,
                                aiAssistantManager,
                                vm,
                                { isExecutingAI = it }
                            )
                        }
                    } else {
                        // Show confirmation dialog
                        showSttConfirmation = true
                    }
                }
                is SpeechToTextEvent.Error -> {
                    // Could show a snackbar here for errors
                }
                is SpeechToTextEvent.PermissionRequired -> {
                    // Handle permission request
                }
                else -> {}
            }
        }
    }

    // Handle transcription result changes for auto-send
    LaunchedEffect(transcriptionResult, isListening) {
        if (transcriptionResult.isNotEmpty() && !isListening && autoSendStt) {
            vm.sendPrompt(transcriptionResult)
            if (aiExecutionEnabled && aiAssistantManager != null) {
                executeAICommandSilently(
                    transcriptionResult,
                    aiAssistantManager,
                    vm,
                    { isExecutingAI = it }
                )
            }
        }
    }

    // Auto-scroll to bottom when new messages are added
    LaunchedEffect(chatMessages.size) {
        if (chatMessages.isNotEmpty()) {
            coroutineScope.launch {
                listState.animateScrollToItem(chatMessages.size - 1)
            }
        }
    }

    // Check if we should show scroll to bottom button
    LaunchedEffect(listState.firstVisibleItemIndex) {
        showScrollToBottom = listState.firstVisibleItemIndex < chatMessages.size - 3
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F5F5))
    ) {
        // Top Bar
        TopAppBar(
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "🤖 AI Assistant",
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.Black,
                        fontWeight = FontWeight.Bold
                    )
                    // Subtle indicator when AI is executing
                    if (isExecutingAI) {
                        Spacer(modifier = Modifier.width(8.dp))
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.Black
                    )
                }
            },
            actions = {
                // Settings icon for AI execution toggle
                IconButton(onClick = { aiExecutionEnabled = !aiExecutionEnabled }) {
                    Icon(
                        imageVector = if (aiExecutionEnabled) Icons.Filled.PlayArrow else Icons.Filled.Clear,
                        contentDescription = "Toggle AI Execution",
                        tint = if (aiExecutionEnabled) Color.Green else Color.Gray
                    )
                }
                IconButton(onClick = { showClearChatDialog = true }) {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = "Clear Chat",
                        tint = Color.Black
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.White
            )
        )

        // Settings Row (simplified)
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Model Selector
                    OutlinedButton(
                        onClick = { showModelSelector = true },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Model: $selectedModel", color = Color.Black)
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    // Streaming Toggle
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Stream",
                            color = Color.Black,
                            modifier = Modifier.padding(end = 8.dp),
                            fontSize = 14.sp
                        )
                        Switch(
                            checked = useStreaming,
                            onCheckedChange = { vm.toggleStreaming() }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Second row: Auto-send STT toggle & AI execution status
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = "Auto-send speech",
                            color = Color.Black,
                            fontSize = 14.sp
                        )
                        Switch(
                            checked = autoSendStt,
                            onCheckedChange = { autoSendStt = it }
                        )
                    }

                    // AI execution status (subtle)
                    if (aiAssistantManager != null) {
                        Text(
                            text = if (aiExecutionEnabled) "AI: ON" else "AI: OFF",
                            color = if (aiExecutionEnabled) Color.Green else Color.Gray,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }

        // Chat Messages
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                state = listState,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(chatMessages) { message ->
                    ChatMessageItem(
                        message = message,
                        isStreaming = isLoading && !message.isUser && message.content.isNotEmpty() && useStreaming
                    )
                }

                // Show typing indicator when streaming is active but no response yet
                if (isLoading && useStreaming && chatMessages.isNotEmpty() && chatMessages.last().isUser) {
                    item {
                        ChatMessageItem(
                            message = ChatMessage(
                                content = "",
                                isUser = false,
                                model = selectedModel
                            ),
                            isStreaming = true
                        )
                    }
                }
            }

            // Scroll to bottom button
            if (showScrollToBottom && chatMessages.isNotEmpty()) {
                FloatingActionButton(
                    onClick = {
                        coroutineScope.launch {
                            listState.animateScrollToItem(chatMessages.size - 1)
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(16.dp),
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                ) {
                    Icon(
                        imageVector = Icons.Filled.KeyboardArrowDown,
                        contentDescription = "Scroll to bottom"
                    )
                }
            }
        }

        // Input Section
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom
                ) {
                    // Text Input
                    OutlinedTextField(
                        value = prompt,
                        onValueChange = { prompt = it },
                        label = { Text("Enter your message", color = Color.Gray) },
                        modifier = Modifier.weight(1f),
                        minLines = 1,
                        maxLines = 4,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.Black,
                            unfocusedTextColor = Color.Black,
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = Color.Gray
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Microphone Button
                    FloatingActionButton(
                        onClick = {
                            if (isListening) {
                                sttVm.stopListening()
                            } else {
                                sttVm.startListening()
                            }
                        },
                        modifier = Modifier.size(56.dp),
                        containerColor = if (isListening || isProcessing) Color.Red else MaterialTheme.colorScheme.primary,
                        contentColor = Color.White
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = if (isListening) Icons.Filled.Close else Icons.Filled.Phone,
                                contentDescription = if (isListening) "Stop Recording" else "Start Recording"
                            )
                        }
                    }
                }

                // Show real-time transcription while recording
                if (isListening && transcriptionResult.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFE3F2FD)
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.Red
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Recording...",
                                    color = Color.Red,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = transcriptionResult,
                                color = Color.Black,
                                fontSize = 14.sp,
                                lineHeight = 18.sp
                            )
                        }
                    }
                }

                // Show transcription result after recording stops
                if (!isListening && transcriptionResult.isNotEmpty() && !autoSendStt) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFE8F5E8)
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Transcription Complete",
                                    color = Color.Green,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.weight(1f))
                                TextButton(
                                    onClick = {
                                        prompt = transcriptionResult
                                        sttVm.clearResults()
                                    }
                                ) {
                                    Text(
                                        text = "Use as Message",
                                        color = MaterialTheme.colorScheme.primary,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = transcriptionResult,
                                color = Color.Black,
                                fontSize = 14.sp,
                                lineHeight = 18.sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Button(
                        onClick = {
                            if (prompt.isNotBlank()) {
                                // Send to chat
                                vm.sendPrompt(prompt)

                                // Execute AI command silently if enabled
                                if (aiExecutionEnabled && aiAssistantManager != null) {
                                    executeAICommandSilently(
                                        prompt,
                                        aiAssistantManager,
                                        vm,
                                        { isExecutingAI = it }
                                    )
                                }

                                prompt = ""
                            }
                        },
                        enabled = prompt.isNotBlank() && !isLoading && !isExecutingAI,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        if (isLoading || isExecutingAI) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(
                            if (isLoading) "Sending..." else "Send",
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                }
            }
        }
    }

    // Model Selection Dialog
    if (showModelSelector) {
        AlertDialog(
            onDismissRequest = { showModelSelector = false },
            title = { Text("Select Model", color = Color.Black) },
            text = {
                Column {
                    listOf("gemma3n:e2b", "llama3.2", "mistral", "codellama").forEach { model ->
                        TextButton(
                            onClick = {
                                vm.setModel(model)
                                showModelSelector = false
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = model,
                                color = if (selectedModel == model) MaterialTheme.colorScheme.primary else Color.Black
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showModelSelector = false }) {
                    Text("Cancel", color = Color.Black)
                }
            }
        )
    }

    // Clear Chat Dialog
    if (showClearChatDialog) {
        AlertDialog(
            onDismissRequest = { showClearChatDialog = false },
            title = { Text("Clear Chat", color = Color.Black) },
            text = { Text("Are you sure you want to clear all chat messages?", color = Color.Black) },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.clearChat()
                        showClearChatDialog = false
                    }
                ) {
                    Text("Clear", color = Color.Red)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearChatDialog = false }) {
                    Text("Cancel", color = Color.Black)
                }
            }
        )
    }

    // STT Confirmation Dialog
    if (showSttConfirmation) {
        AlertDialog(
            onDismissRequest = {
                showSttConfirmation = false
                pendingTranscription = ""
            },
            title = { Text("Speech Detected", color = Color.Black) },
            text = {
                Column {
                    Text(
                        text = "You said:",
                        color = Color.Black,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = pendingTranscription,
                        color = Color.Black,
                        fontSize = 16.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Would you like to send this message to the AI?",
                        color = Color.Gray,
                        fontSize = 14.sp
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        prompt = pendingTranscription
                        showSttConfirmation = false
                        pendingTranscription = ""
                    }
                ) {
                    Text("Use as Message", color = MaterialTheme.colorScheme.primary)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showSttConfirmation = false
                        pendingTranscription = ""
                    }
                ) {
                    Text("Cancel", color = Color.Black)
                }
            }
        )
    }
}

@Composable
fun ChatMessageItem(
    message: ChatMessage,
    isStreaming: Boolean = false
) {
    val isUser = message.isUser

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Card(
            modifier = Modifier.widthIn(max = 280.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isUser) MaterialTheme.colorScheme.primary else Color.White
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isUser) 16.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 16.dp
            )
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                if (message.content.isNotEmpty()) {
                    Text(
                        text = message.content,
                        color = if (isUser) Color.White else Color.Black,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                }

                if (!isUser && message.model.isNotEmpty()) {
                    if (message.content.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                    Text(
                        text = "via ${message.model}",
                        color = if (isUser) Color.White.copy(alpha = 0.7f) else Color.Gray,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Light
                    )
                }

                if (isStreaming) {
                    if (message.content.isNotEmpty() || (!isUser && message.model.isNotEmpty())) {
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(12.dp),
                            strokeWidth = 2.dp,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Streaming...",
                            color = Color.Gray,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Light
                        )
                    }
                }
            }
        }
    }
}