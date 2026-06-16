package com.feedin.app.data.local.db

import com.feedin.app.core.sync.PendingAction
import com.feedin.app.data.local.CachedConversation
import com.feedin.app.data.local.CachedMessage
import com.feedin.app.data.local.CachedPost
import com.feedin.app.data.local.db.entity.ConversationEntity
import com.feedin.app.data.local.db.entity.MessageEntity
import com.feedin.app.data.local.db.entity.PendingActionEntity
import com.feedin.app.data.local.db.entity.PostEntity

fun PostEntity.toCachedPost(): CachedPost = CachedPost(
    id = id,
    authorId = authorId,
    authorName = authorName,
    body = body,
    mediaUrl = mediaUrl,
    createdAtMillis = createdAtMillis,
    syncedAtMillis = syncedAtMillis,
)

fun CachedPost.toEntity(): PostEntity = PostEntity(
    id = id,
    authorId = authorId,
    authorName = authorName,
    body = body,
    mediaUrl = mediaUrl,
    createdAtMillis = createdAtMillis,
    syncedAtMillis = syncedAtMillis,
)

fun ConversationEntity.toCachedConversation(): CachedConversation = CachedConversation(
    id = id,
    title = title,
    lastMessagePreview = lastMessagePreview,
    updatedAtMillis = updatedAtMillis,
)

fun CachedConversation.toEntity(): ConversationEntity = ConversationEntity(
    id = id,
    title = title,
    lastMessagePreview = lastMessagePreview,
    updatedAtMillis = updatedAtMillis,
)

fun MessageEntity.toCachedMessage(): CachedMessage = CachedMessage(
    id = id,
    conversationId = conversationId,
    senderId = senderId,
    body = body,
    mediaUrl = mediaUrl,
    createdAtMillis = createdAtMillis,
    deliveryState = deliveryState,
)

fun CachedMessage.toEntity(): MessageEntity = MessageEntity(
    id = id,
    conversationId = conversationId,
    senderId = senderId,
    body = body,
    mediaUrl = mediaUrl,
    createdAtMillis = createdAtMillis,
    deliveryState = deliveryState,
)

fun PendingActionEntity.toPendingAction(): PendingAction = PendingAction(
    localId = localId,
    type = type,
    payloadJson = payloadJson,
    createdAtMillis = createdAtMillis,
    retryCount = retryCount,
)

fun PendingAction.toEntity(): PendingActionEntity = PendingActionEntity(
    localId = localId,
    type = type,
    payloadJson = payloadJson,
    createdAtMillis = createdAtMillis,
    retryCount = retryCount,
)

