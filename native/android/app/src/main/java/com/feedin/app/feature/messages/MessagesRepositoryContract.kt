package com.feedin.app.feature.messages

import com.feedin.app.data.local.CachedConversation
import com.feedin.app.data.local.CachedMessage
import kotlinx.coroutines.flow.Flow

interface MessagesRepositoryContract {
    fun observeConversations(): Flow<List<CachedConversation>>
    fun observeMessages(conversationId: String): Flow<List<CachedMessage>>
    suspend fun queueMessage(conversationId: String, body: String)
}
