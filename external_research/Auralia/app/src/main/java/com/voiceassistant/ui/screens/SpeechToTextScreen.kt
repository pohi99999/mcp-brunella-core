package com.voiceassistant.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.voiceassistant.viewmodel.SpeechToTextEvent
import com.voiceassistant.viewmodel.SpeechToTextViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpeechToTextScreen(
    onBackClick: () -> Unit = {},
    onTranscriptionComplete: (String) -> Unit = {}
) {
    val viewModel: SpeechToTextViewModel = viewModel()
    val context = LocalContext.current
    
    // Collect state
    val isReady by viewModel.isReady.collectAsState()
    val isRecording by viewModel.isRecording.collectAsState()
    val isListening by viewModel.isListening.collectAsState()
    val isProcessing by viewModel.isProcessing.collectAsState()
    val audioLevel by viewModel.audioLevel.collectAsState()
    val recordingDuration by viewModel.recordingDuration.collectAsState()
    val transcriptionResult by viewModel.transcriptionResult.collectAsState()
    val error by viewModel.error.collectAsState()
    
    // Collect events
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is SpeechToTextEvent.TranscriptionComplete -> {
                    onTranscriptionComplete(event.transcription)
                }
                is SpeechToTextEvent.Error -> {
                    // Handle error (could show a snackbar)
                }
                is SpeechToTextEvent.PermissionRequired -> {
                    // Handle permission request
                }
                else -> {}
            }
        }
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Top Bar
            TopAppBar(
                title = {
                    Text(
                        text = "Speech to Text",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Black
                )
            )
            
            // Main Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(32.dp))
                
                // Status Card
                StatusCard(
                    isReady = isReady,
                    isRecording = isRecording,
                    isListening = isListening,
                    isProcessing = isProcessing,
                    error = error
                )
                
                Spacer(modifier = Modifier.height(48.dp))
                
                // Audio Level Indicator
                AudioLevelIndicator(
                    audioLevel = audioLevel,
                    isRecording = isRecording,
                    recordingDuration = recordingDuration,
                    viewModel = viewModel
                )
                
                Spacer(modifier = Modifier.height(48.dp))
                
                // Record Button
                RecordButton(
                    isReady = isReady,
                    isRecording = isRecording,
                    isListening = isListening,
                    isProcessing = isProcessing,
                    onToggleRecording = { viewModel.toggleListening() }
                )
                
                Spacer(modifier = Modifier.height(48.dp))
                
                // Transcription Result
                TranscriptionResultCard(
                    transcriptionResult = transcriptionResult,
                    isProcessing = isProcessing,
                    onClear = { viewModel.clearResults() }
                )
                
                Spacer(modifier = Modifier.weight(1f))
                
                // Instructions
                InstructionsCard()
            }
        }
    }
}

@Composable
fun StatusCard(
    isReady: Boolean,
    isRecording: Boolean,
    isListening: Boolean,
    isProcessing: Boolean,
    error: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF2A2A2A)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            val (icon, text, color) = when {
                error != null -> Triple(
                    Icons.Filled.Warning,
                    "Error: $error",
                    Color.Red
                )
                isProcessing -> Triple(
                    Icons.Filled.Refresh,
                    "Processing audio...",
                    Color(0xFF6C5CE7)
                )
                isListening -> Triple(
                    Icons.Filled.Star,
                    "Listening...",
                    Color(0xFF6C5CE7)
                )
                isRecording -> Triple(
                    Icons.Filled.Star,
                    "Recording...",
                    Color(0xFF6C5CE7)
                )
                isReady -> Triple(
                    Icons.Filled.CheckCircle,
                    "Ready to listen",
                    Color.Green
                )
                else -> Triple(
                    Icons.Filled.Refresh,
                    "Loading...",
                    Color.Gray
                )
            }
            
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(32.dp)
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = text,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun AudioLevelIndicator(
    audioLevel: Float,
    isRecording: Boolean,
    recordingDuration: Long,
    viewModel: SpeechToTextViewModel
) {
    val animatedAudioLevel by animateFloatAsState(
        targetValue = audioLevel,
        animationSpec = tween(100),
        label = "audioLevel"
    )
    
    val pulseAnimation by rememberInfiniteTransition().animateFloat(
        initialValue = 0.8f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Audio Level Bars
        Row(
            modifier = Modifier.height(120.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            repeat(20) { index ->
                val barHeight = if (isRecording) {
                    val targetHeight = (animatedAudioLevel * 100).toInt()
                    val barIndex = index + 1
                    if (barIndex <= targetHeight / 5) {
                        100f
                    } else {
                        (targetHeight % 5) * 20f
                    }
                } else {
                    0f
                }
                
                val animatedHeight by animateFloatAsState(
                    targetValue = barHeight,
                    animationSpec = tween(100),
                    label = "barHeight"
                )
                
                Box(
                    modifier = Modifier
                        .width(8.dp)
                        .height((animatedHeight * 1.2).dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(
                            if (isRecording) Color(0xFF6C5CE7) else Color.Gray.copy(alpha = 0.3f)
                        )
                )
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Recording Duration
        if (isRecording) {
            Text(
                text = viewModel.formatDuration(recordingDuration),
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
        }
        
        // Audio Level Percentage
        if (isRecording) {
            Text(
                text = "${viewModel.getAudioLevelPercentage()}%",
                color = Color.Gray,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun RecordButton(
    isReady: Boolean,
    isRecording: Boolean,
    isListening: Boolean,
    isProcessing: Boolean,
    onToggleRecording: () -> Unit
) {
    val scale by animateFloatAsState(
        targetValue = if (isRecording || isListening) 1.1f else 1f,
        animationSpec = tween(200),
        label = "scale"
    )
    
    val pulseAnimation by rememberInfiniteTransition().animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )
    
    Box(
        modifier = Modifier
            .size(120.dp)
            .scale(if (isRecording) pulseAnimation else scale)
            .clip(CircleShape)
                    .background(
            when {
                isProcessing -> Color.Gray
                isRecording || isListening -> Color.Red
                isReady -> Color(0xFF6C5CE7)
                else -> Color.Gray
            }
        ),
        contentAlignment = Alignment.Center
    ) {
        IconButton(
            onClick = onToggleRecording,
            enabled = isReady && !isProcessing,
            modifier = Modifier.fillMaxSize()
        ) {
            Icon(
                imageVector = when {
                    isRecording || isListening -> Icons.Filled.Close
                    else -> Icons.Filled.Star
                },
                contentDescription = if (isRecording || isListening) "Stop Listening" else "Start Listening",
                tint = Color.White,
                modifier = Modifier.size(48.dp)
            )
        }
    }
}

@Composable
fun TranscriptionResultCard(
    transcriptionResult: String,
    isProcessing: Boolean,
    onClear: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF2A2A2A)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Transcription",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                
                if (transcriptionResult.isNotEmpty()) {
                    IconButton(onClick = onClear) {
                        Icon(
                            imageVector = Icons.Filled.Clear,
                            contentDescription = "Clear",
                            tint = Color.Gray
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            if (isProcessing) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = Color(0xFF6C5CE7),
                        strokeWidth = 2.dp
                    )
                    Text(
                        text = "Processing audio...",
                        color = Color.Gray,
                        fontSize = 14.sp
                    )
                }
            } else if (transcriptionResult.isNotEmpty()) {
                Text(
                    text = transcriptionResult,
                    color = Color.White,
                    fontSize = 16.sp,
                    lineHeight = 24.sp
                )
            } else {
                Text(
                    text = "Tap the microphone to start recording",
                    color = Color.Gray,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
fun InstructionsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF2A2A2A)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            Text(
                text = "How to use",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            InstructionItem(
                icon = Icons.Filled.Star,
                text = "Tap the microphone button to start listening"
            )
            
            InstructionItem(
                icon = Icons.Filled.Close,
                text = "Tap again to stop listening"
            )
            
            InstructionItem(
                icon = Icons.Filled.Refresh,
                text = "Wait for speech recognition to process"
            )
            
            InstructionItem(
                icon = Icons.Filled.CheckCircle,
                text = "View your transcribed text in the result area"
            )
        }
    }
}

@Composable
fun InstructionItem(
    icon: ImageVector,
    text: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color(0xFF6C5CE7),
            modifier = Modifier.size(20.dp)
        )
        
        Text(
            text = text,
            color = Color.Gray,
            fontSize = 14.sp
        )
    }
} 