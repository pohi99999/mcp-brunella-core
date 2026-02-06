package com.voiceassistant.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.voiceassistant.R

@Composable
fun WelcomeScreen() {
    // Fond noir comme dans votre image
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Logo Auralia
            Image(
                painter = painterResource(id = R.drawable.logo_auralia),
                contentDescription = "Logo Auralia",
                modifier = Modifier.size(120.dp)
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Titre principal - identique à votre image
            Text(
                text = "Welcome to Auralia, your\nvoice-controlled assistant.",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                lineHeight = 32.sp,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Texte avec "Hi Auralia" en couleur - comme dans votre image
            val annotatedText = buildAnnotatedString {
                append("Activate by saying ")
                withStyle(
                    style = SpanStyle(
                        color = Color(0xFF6C5CE7), // Couleur violette comme dans l'image
                        fontWeight = FontWeight.Bold
                    )
                ) {
                    append("Hi Auralia")
                }
                append(" to start\nnavigating your device hands-free.")
            }

            Text(
                text = annotatedText,
                color = Color.White,
                fontSize = 18.sp,
                textAlign = TextAlign.Center,
                lineHeight = 26.sp,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}