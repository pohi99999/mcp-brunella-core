// AgentScreen.kt
package com.voiceassistant.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.voiceassistant.agent.VoiceAgent
import com.voiceassistant.agent.core.AccessibilityActionExecutor
import com.voiceassistant.agent.example.AgentExample
import kotlinx.coroutines.launch

@Composable
fun AgentScreen(
    onBackClick: () -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    
    var voiceAgent by remember { mutableStateOf<VoiceAgent?>(null) }
    var isRunning by remember { mutableStateOf(false) }
    var currentTask by remember { mutableStateOf<String?>(null) }
    var executedActions by remember { mutableStateOf<List<String>>(emptyList()) }
    var lastResult by remember { mutableStateOf<String?>(null) }
    var userRequest by remember { mutableStateOf("Open the Settings app") }

    // Initialize agent
    LaunchedEffect(Unit) {
        val agent = VoiceAgent(context)
        agent.setActionExecutor(AccessibilityActionExecutor(context))
        voiceAgent = agent
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .padding(top = 32.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.Black
                )
            }
            Text(
                text = "Voice Agent",
                style = MaterialTheme.typography.headlineMedium,
                color = Color.Black
            )
            Spacer(modifier = Modifier.width(48.dp))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Status
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (isRunning) Color(0xFFE8F5E8) else Color(0xFFF5F5F5)
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Status: ${if (isRunning) "Running" else "Idle"}",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.Black
                )
                if (currentTask != null) {
                    Text(
                        text = "Task: $currentTask",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Black
                    )
                }
                if (lastResult != null) {
                    Text(
                        text = "Last Result: $lastResult",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.Gray
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Input
        OutlinedTextField(
            value = userRequest,
            onValueChange = { userRequest = it },
            label = { Text("Enter your request", color = Color.Gray) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 3,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Color.Black,
                unfocusedTextColor = Color.Black,
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = Color.Gray
            )
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Control buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    scope.launch {
                        voiceAgent?.let { agent ->
                            isRunning = true
                            currentTask = userRequest
                            executedActions = emptyList()
                            lastResult = null
                            
                            // Start the task
                            agent.startTask(userRequest)
                            
                            // Monitor progress
                            agent.isRunning.collect { running ->
                                isRunning = running
                                if (!running) {
                                    lastResult = "Task completed"
                                }
                            }
                        }
                    }
                },
                enabled = !isRunning && userRequest.isNotBlank(),
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Filled.PlayArrow, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Start Task")
            }

            Button(
                onClick = {
                    voiceAgent?.stopTask()
                    isRunning = false
                    lastResult = "Task stopped by user"
                },
                enabled = isRunning,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Red
                )
            ) {
                Icon(Icons.Filled.Close, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Stop")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Example buttons
        Text(
            text = "Quick Examples:",
            style = MaterialTheme.typography.titleSmall,
            color = Color.Black
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = { userRequest = "Open the Settings app" },
                modifier = Modifier.weight(1f)
            ) {
                Text("Settings", color = Color.Black)
            }
            
            OutlinedButton(
                onClick = { userRequest = "Open Chrome browser" },
                modifier = Modifier.weight(1f)
            ) {
                Text("Chrome", color = Color.Black)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Executed actions
        if (executedActions.isNotEmpty()) {
            Text(
                text = "Executed Actions:",
                style = MaterialTheme.typography.titleSmall,
                color = Color.Black
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            LazyColumn(
                modifier = Modifier.weight(1f)
            ) {
                items(executedActions) { action ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp)
                    ) {
                        Text(
                            text = action,
                            modifier = Modifier.padding(8.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Black
                        )
                    }
                }
            }
        }
    }
} 