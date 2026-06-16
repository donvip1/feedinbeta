package com.feedin.app.core.security

interface SecureStorageContract {
    suspend fun saveSession(accessToken: String, refreshToken: String)
    suspend fun readSession(): SessionTokens?
    suspend fun clearSession()
}

data class SessionTokens(
    val accessToken: String,
    val refreshToken: String,
)

