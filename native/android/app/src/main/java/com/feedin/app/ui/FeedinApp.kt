package com.feedin.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.feedin.app.FeedinAppContainer
import com.feedin.app.core.config.FeedinConfig
import com.feedin.app.core.session.AuthSessionState
import com.feedin.app.core.storage.FeedinStorageBudgets
import com.feedin.app.data.local.CachedPost
import com.feedin.app.feature.auth.AuthScreen

private enum class FeedinTab(
    val label: String,
    val icon: ImageVector,
) {
    Feed("Feed", Icons.Filled.Home),
    Create("Create", Icons.Filled.AddCircle),
    Messages("Messages", Icons.Filled.Mail),
    Profile("Profile", Icons.Filled.Person),
    Settings("Settings", Icons.Filled.Settings),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedinApp(appContainer: FeedinAppContainer) {
    val config = FeedinConfig.fromBuildConfig()
    var sessionState by remember { mutableStateOf<AuthSessionState>(AuthSessionState.SignedOut) }

    when (val currentSession = sessionState) {
        AuthSessionState.Checking -> StartupScreen()
        AuthSessionState.SignedOut -> AuthScreen(
            isConfigured = config.isConfigured,
            onDemoSignIn = {
                sessionState = AuthSessionState.SignedIn(
                    userId = "local-demo",
                    displayName = "FEEDIN Tester",
                )
            },
        )
        is AuthSessionState.SignedIn -> MainShell(
            appContainer = appContainer,
            displayName = currentSession.displayName,
            onSignOut = { sessionState = AuthSessionState.SignedOut },
        )
    }
}

@Composable
private fun StartupScreen() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "FEEDIN",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainShell(
    appContainer: FeedinAppContainer,
    displayName: String,
    onSignOut: () -> Unit,
) {
    var selectedTab by rememberSaveable { mutableStateOf(FeedinTab.Feed) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "FEEDIN",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = displayName,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                FeedinTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            when (selectedTab) {
                FeedinTab.Feed -> FeedScreen(appContainer = appContainer)
                FeedinTab.Create -> PlaceholderScreen(
                    title = "Create post",
                    summary = "Drafts, media picking, upload queue, and offline publishing will start here.",
                )
                FeedinTab.Messages -> PlaceholderScreen(
                    title = "Messages",
                    summary = "The native inbox will read from local Room storage first, then sync realtime updates.",
                )
                FeedinTab.Profile -> PlaceholderScreen(
                    title = "Profile",
                    summary = "Profile cache, edit basics, friends, and media grid belong in the native v1 scope.",
                )
                FeedinTab.Settings -> SettingsScreen(
                    onSignOut = onSignOut,
                )
            }
        }
    }
}

@Composable
private fun FeedScreen(appContainer: FeedinAppContainer) {
    LaunchedEffect(appContainer.feedRepository) {
        appContainer.feedRepository.seedDemoPostsIfEmpty()
    }

    val posts by appContainer.feedRepository
        .observeCachedFeed()
        .collectAsStateWithLifecycle(initialValue = emptyList())

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AssistChip(onClick = {}, label = { Text("Local-first") })
                AssistChip(onClick = {}, label = { Text("Server-secured") })
            }
        }
        items(posts) { post ->
            CachedPostCard(post)
        }
    }
}

@Composable
private fun CachedPostCard(post: CachedPost) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = post.authorName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = post.body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Cached locally",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun SettingsScreen(onSignOut: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                text = "Device storage",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
        }
        items(FeedinStorageBudgets.defaultBudgets) { budget ->
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = budget.bucket.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "${budget.maxBytes / 1024 / 1024} MB budget",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = if (budget.canEvictAutomatically) "Auto cleanup allowed" else "User data retained",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        item {
            AssistChip(
                onClick = onSignOut,
                label = { Text("Sign out") },
            )
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String, summary: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
