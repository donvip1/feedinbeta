package com.feedin.app.core.sync

enum class PendingActionType {
    CreatePost,
    LikePost,
    SavePost,
    RefeedPost,
    CommentOnPost,
    SendMessage,
    UploadMedia,
}

data class PendingAction(
    val localId: String,
    val type: PendingActionType,
    val payloadJson: String,
    val createdAtMillis: Long,
    val retryCount: Int = 0,
)

interface SyncScheduler {
    fun scheduleImmediateSync()
    fun scheduleBackgroundSync()
}

