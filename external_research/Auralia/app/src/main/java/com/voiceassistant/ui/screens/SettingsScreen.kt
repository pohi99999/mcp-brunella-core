package com.voiceassistant.ui.screens


import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBackClick: () -> Unit = {},
    onAppLanguageClick: () -> Unit = {},
    onVoiceLanguageClick: () -> Unit = {},
    onThemeClick: () -> Unit = {},
    onWakeWordClick: () -> Unit = {},
    onFontSizeClick: () -> Unit = {},
    onServerConfigClick: () -> Unit = {}
) {
    var highContrastMode by remember { mutableStateOf(false) }
    var voiceFeedback by remember { mutableStateOf(true) }
    var commandConfirmation by remember { mutableStateOf(true) }
    var hapticFeedback by remember { mutableStateOf(true) }

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
                        text = "Settings",
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

            // Contenu des paramètres
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {

                // Section Language
                SettingsSection(title = "Language") {
                    SettingsItem(
                        title = "App Language",
                        value = "English",
                        onClick = onAppLanguageClick,
                        showArrow = true
                    )
                    SettingsItem(
                        title = "Voice Input Language",
                        value = "English (US)",
                        onClick = onVoiceLanguageClick,
                        showArrow = true
                    )
                }

                // Section Appearance
                SettingsSection(title = "Appearance") {
                    SettingsItem(
                        title = "Theme",
                        value = "Light",
                        onClick = onThemeClick,
                        showArrow = true
                    )
                    SettingsItemWithSwitch(
                        title = "High Contrast Mode",
                        checked = highContrastMode,
                        onCheckedChange = { highContrastMode = it }
                    )
                }

                // Section Voice Commands
                SettingsSection(title = "Voice Commands") {
                    SettingsItem(
                        title = "Wake Word",
                        value = "Hi Auralia",
                        onClick = onWakeWordClick,
                        showArrow = true
                    )
                    SettingsItemWithSwitch(
                        title = "Voice Feedback",
                        checked = voiceFeedback,
                        onCheckedChange = { voiceFeedback = it }
                    )
                    SettingsItemWithSwitch(
                        title = "Command Confirmation",
                        description = "Require verbal confirmation for critical actions.",
                        checked = commandConfirmation,
                        onCheckedChange = { commandConfirmation = it }
                    )
                }

                // Section Accessibility
                SettingsSection(title = "Accessibility") {
                    SettingsItem(
                        title = "Font Size",
                        value = "Default",
                        onClick = onFontSizeClick,
                        showArrow = true
                    )
                    SettingsItemWithSwitch(
                        title = "Haptic Feedback",
                        description = "Provide physical vibrations for certain actions.",
                        checked = hapticFeedback,
                        onCheckedChange = { hapticFeedback = it }
                    )
                }

                // Section Server Configuration
                SettingsSection(title = "Server Configuration") {
                    SettingsItem(
                        title = "Ollama Server URL",
                        value = "Configure",
                        description = "Set the IP address of your Ollama server",
                        onClick = onServerConfigClick,
                        showArrow = true
                    )
                }
            }
        }
    }
}

@Composable
fun SettingsSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF2A2A2A)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            content()
        }
    }
}

@Composable
fun SettingsItem(
    title: String,
    value: String? = null,
    description: String? = null,
    onClick: () -> Unit,
    showArrow: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .clickable { onClick() },
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            if (description != null) {
                Text(
                    text = description,
                    color = Color.Gray,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (value != null) {
                Text(
                    text = value,
                    color = Color.Gray,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(end = 8.dp)
                )
            }
            if (showArrow) {
                Icon(
                    imageVector = Icons.Default.KeyboardArrowRight,
                    contentDescription = "Arrow",
                    tint = Color.Gray,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun SettingsItemWithSwitch(
    title: String,
    description: String? = null,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            if (description != null) {
                Text(
                    text = description,
                    color = Color.Gray,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }

        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Color(0xFF6C5CE7),
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = Color.Gray
            )
        )
    }
}