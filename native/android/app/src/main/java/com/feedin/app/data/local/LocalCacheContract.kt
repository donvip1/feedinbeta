package com.feedin.app.data.local

data class CachedPost(
    val id: String,
    val authorId: String,
    val authorName: String,
    val body: String,
    val mediaUrl: String?,
    val createdAtMillis: Long,
    val syncedAtMillis: Long,
)

data class CachedConversation(
    val id: String,
    val title: String?,
    val lastMessagePreview: String?,
    val updatedAtMillis: Long,
)

data class CachedMessage(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val body: String?,
    val mediaUrl: String?,
    val createdAtMillis: Long,
    val deliveryState: MessageDeliveryState,
)

enum class MessageDeliveryState {
    Pending,
    Sent,
    Delivered,
    Read,
    Failed,
}

