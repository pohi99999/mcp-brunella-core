package com.voiceassistant.ui.screens
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.voiceassistant.R
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAssistantScreen(
    isListening: Boolean = true,
    onSetAlarm: () -> Unit = {},
    onSendSMS: () -> Unit = {},
    onManageApps: () -> Unit = {},
    onWebNavigation: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onTestClick: () -> Unit = {},
    onLlamaClick: () -> Unit = {},
    onAgentClick: () -> Unit = {},
    onSpeechToTextClick: () -> Unit = {},
    onImageAnalysisClick: () -> Unit = {}
) {
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
                        text = "Auralia",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onMenuClick) {
                        Icon(
                            imageVector = Icons.Filled.Menu,
                            contentDescription = "Menu",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onProfileClick) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(Color.Gray),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "AU",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Black
                )
            )

            // Contenu principal
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(80.dp))

                // Icône microphone centrale
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(
                            if (isListening) Color(0xFF6C5CE7) else Color.Gray
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_microphone),
                        contentDescription = "Microphone",
                        modifier = Modifier.size(60.dp),
                        colorFilter = ColorFilter.tint(Color.White)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Texte d'état
                val statusText = buildAnnotatedString {
                    append("Say a command — ")
                    withStyle(
                        style = SpanStyle(
                            color = Color(0xFF6C5CE7),
                            fontWeight = FontWeight.Bold
                        )
                    ) {
                        append("Auralia")
                    }
                    append(" is listening")
                }

                Text(
                    text = statusText,
                    color = Color.White,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(64.dp))

                // Grille des raccourcis avec les meilleures icônes disponibles
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_alarm,
                            title = "Set Alarm",
                            onClick = onSetAlarm
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_sms,
                            title = "Send SMS",
                            onClick = onSendSMS
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_apps,
                            title = "Manage Apps",
                            onClick = onManageApps
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_web,
                            title = "Web\nNavigation",
                            onClick = onWebNavigation
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_mic,
                            title = "Gemma\nChat",
                            onClick = onLlamaClick
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_web,
                            title = "Voice\nAgent",
                            onClick = onAgentClick
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_mic,
                            title = "Speech to\nText",
                            onClick = onSpeechToTextClick
                        )
                    }
                    item {
                        CustomCommandCard(
                            iconRes = R.drawable.ic_web,
                            title = "Image\nAnalysis",
                            onClick = onImageAnalysisClick
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Test button for accessibility automation
                Button(
                    onClick = onTestClick,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF6C5CE7)
                    )
                ) {
                    Text(
                        text = "Test Simple Click",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
fun CustomCommandCard(
    iconRes: Int, // ID de votre ressource drawable
    title: String,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(150.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF2A2A2A)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF6C5CE7).copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = iconRes), // 🎯 Votre icône personnalisée
                    contentDescription = title,
                    modifier = Modifier.size(24.dp),
                    colorFilter = ColorFilter.tint(Color(0xFF6C5CE7))
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = title,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )
        }
    }
}