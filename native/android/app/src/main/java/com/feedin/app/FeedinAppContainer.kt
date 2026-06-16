package com.feedin.app

import android.content.Context
import com.feedin.app.core.sync.WorkManagerSyncScheduler
import com.feedin.app.data.local.db.FeedinDatabase
import com.feedin.app.data.repository.LocalFeedRepository
import com.feedin.app.data.repository.LocalMessagesRepository

class FeedinAppContainer(context: Context) {
    val database: FeedinDatabase by lazy {
        FeedinDatabase.create(context)
    }

    val feedRepository: LocalFeedRepository by lazy {
        LocalFeedRepository(
            postDao = database.postDao(),
            pendingActionDao = database.pendingActionDao(),
            syncScheduler = syncScheduler,
        )
    }

    val messagesRepository: LocalMessagesRepository by lazy {
        LocalMessagesRepository(
            conversationDao = database.conversationDao(),
            messageDao = database.messageDao(),
            pendingActionDao = database.pendingActionDao(),
            syncScheduler = syncScheduler,
        )
    }

    val syncScheduler: WorkManagerSyncScheduler by lazy {
        WorkManagerSyncScheduler(context)
    }
}
