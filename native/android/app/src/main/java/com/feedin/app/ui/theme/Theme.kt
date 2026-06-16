package com.feedin.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val FeedinDarkScheme = darkColorScheme(
    primary = Color(0xFF22C55E),
    secondary = Color(0xFF38BDF8),
    tertiary = Color(0xFFF59E0B),
    background = Color(0xFF050505),
    surface = Color(0xFF111111),
    surfaceVariant = Color(0xFF1A1A1A),
    onPrimary = Color(0xFF03140A),
    onSecondary = Color(0xFF031018),
    onBackground = Color(0xFFF5F5F5),
    onSurface = Color(0xFFF5F5F5),
    onSurfaceVariant = Color(0xFFC7C7C7),
)

@Composable
fun FeedinTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = FeedinDarkScheme,
        typography = MaterialTheme.typography,
        content = content,
    )
}

