package com.feedin.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.feedin.app.ui.FeedinApp
import com.feedin.app.ui.theme.FeedinTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FeedinTheme {
                FeedinApp(
                    appContainer = (application as FeedinApplication).appContainer,
                )
            }
        }
    }
}
