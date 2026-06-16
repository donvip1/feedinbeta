package com.feedin.app.core.session

sealed interface AuthSessionState {
    data object Checking : AuthSessionState
    data object SignedOut : AuthSessionState
    data class SignedIn(
        val userId: String,
        val displayName: String,
    ) : AuthSessionState
}

