package com.feedin.app.data.repository

import com.feedin.app.core.sync.PendingAction
import com.feedin.app.core.sync.PendingActionType
import com.feedin.app.core.sync.SyncScheduler
import com.feedin.app.data.local.CachedConversation
import com.feedin.app.data.local.CachedMessage
import com.feedin.app.data.local.db.dao.ConversationDao
import com.feedin.app.data.local.db.dao.MessageDao
import com.feedin.app.data.local.db.dao.PendingActionDao
import com.feedin.app.data.local.db.toCachedConversation
import com.feedin.app.data.local.db.toCachedMessage
import com.feedin.app.data.local.db.toEntity
import com.feedin.app.feature.messages.MessagesRepositoryContract
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class LocalMessagesRepository(
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao,
    private val pendingActionDao: PendingActionDao,
    private val syncScheduler: SyncScheduler,
) : MessagesRepositoryContract {
    override fun observeConversations(): Flow<List<CachedConversation>> =
        conversationDao.observeConversations().map { conversations ->
            conversations.map { it.toCachedConversation() }
        }

    override fun observeMessages(conversationId: String): Flow<List<CachedMessage>> =
        messageDao.observeMessages(conversationId).map { messages ->
            messages.map { it.toCachedMessage() }
        }

    override suspend fun queueMessage(conversationId: String, body: String) {
        pendingActionDao.upsertAction(
            PendingAction(
                localId = UUID.randomUUID().toString(),
                type = PendingActionType.SendMessage,
                payloadJson = """{"conversationId":"$conversationId","body":"$body"}""",
                createdAtMillis = System.currentTimeMillis(),
            ).toEntity(),
        )
        syncScheduler.scheduleImmediateSync()
    }
}
