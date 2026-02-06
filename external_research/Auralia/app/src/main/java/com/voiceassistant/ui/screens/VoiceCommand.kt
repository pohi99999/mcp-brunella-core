package com.voiceassistant.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class VoiceCommand(
    val id: Int,
    val command: String,
    val timestamp: String,
    val icon: ImageVector = Icons.Filled.Phone // Utilise une icône qui existe
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    onBackClick: () -> Unit = {},
    onPlayCommand: (VoiceCommand) -> Unit = {},
    onEditCommand: (VoiceCommand) -> Unit = {}
) {
    // Données d'exemple basées sur votre image
    val commands = remember {
        listOf(
            VoiceCommand(1, "Set a timer for 15 minutes", "Just now"),
            VoiceCommand(2, "Call John Doe on mobile", "5 minutes ago"),
            VoiceCommand(3, "Play Jazz music on Spotify", "1 hour ago"),
            VoiceCommand(4, "What is the weather like today", "Yesterday 08:00 AM"),
            VoiceCommand(5, "Send a text message to Mom", "Yesterday 06:30 PM"),
            VoiceCommand(6, "Find the nearest coffee shop", "2 days ago"),
            VoiceCommand(7, "Add milk to my shopping list", "3 days ago"),
            VoiceCommand(8, "Remind me to take out the trash", "4 days ago"),
            VoiceCommand(9, "Open Google Maps and navigate home", "5 days ago"),
            VoiceCommand(10, "Translate \"hello\" to Spanish", "1 week ago")
        )
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
                        text = "History",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Black
                )
            )

            // Liste des commandes
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(vertical = 16.dp)
            ) {
                items(commands) { command ->
                    HistoryCommandCard(
                        command = command,
                        onPlayClick = { onPlayCommand(command) },
                        onEditClick = { onEditCommand(command) }
                    )
                }
            }
        }
    }
}

@Composable
fun HistoryCommandCard(
    command: VoiceCommand,
    onPlayClick: () -> Unit,
    onEditClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF2A2A2A)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icône microphone à gauche
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF6C5CE7).copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Phone, // Icône temporaire qui existe
                    contentDescription = "Voice Command",
                    tint = Color(0xFF6C5CE7),
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(20.dp))

            // Texte de la commande et timestamp
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = command.command,
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = command.timestamp,
                    color = Color.Gray,
                    fontSize = 14.sp
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Boutons Play et Edit
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Bouton Play
                IconButton(
                    onClick = onPlayClick,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF6C5CE7).copy(alpha = 0.2f))
                ) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = "Play Command",
                        tint = Color(0xFF6C5CE7),
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Bouton Edit
                IconButton(
                    onClick = onEditClick,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.Gray.copy(alpha = 0.2f))
                ) {
                    Icon(
                        imageVector = Icons.Filled.Edit,
                        contentDescription = "Edit Command",
                        tint = Color.Gray,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}