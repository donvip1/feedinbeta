package com.feedin.app.data.repository

import com.feedin.app.core.sync.PendingAction
import com.feedin.app.core.sync.PendingActionType
import com.feedin.app.core.sync.SyncScheduler
import com.feedin.app.data.local.CachedPost
import com.feedin.app.data.local.db.dao.PendingActionDao
import com.feedin.app.data.local.db.dao.PostDao
import com.feedin.app.data.local.db.toCachedPost
import com.feedin.app.data.local.db.toEntity
import com.feedin.app.feature.feed.FeedRepositoryContract
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class LocalFeedRepository(
    private val postDao: PostDao,
    private val pendingActionDao: PendingActionDao,
    private val syncScheduler: SyncScheduler,
) : FeedRepositoryContract {
    override suspend fun refreshFeed() {
        // Remote refresh will be added after Supabase API contracts are finalized.
    }

    override fun observeCachedFeed(): Flow<List<CachedPost>> =
        postDao.observeFeed().map { posts -> posts.map { it.toCachedPost() } }

    suspend fun seedDemoPostsIfEmpty() {
        if (postDao.countPosts() > 0) return

        val now = System.currentTimeMillis()
        postDao.upsertPosts(
            listOf(
                CachedPost(
                    id = "demo-native-shell",
                    authorId = "feedin-system",
                    authorName = "FEEDIN System",
                    body = "Native Android shell is active. This post is loaded from the Room cache.",
                    mediaUrl = null,
                    createdAtMillis = now,
                    syncedAtMillis = now,
                ).toEntity(),
                CachedPost(
                    id = "demo-offline-engine",
                    authorId = "offline-engine",
                    authorName = "Offline Engine",
                    body = "Feed, profile, messages, drafts, and pending actions now have a local database foundation.",
                    mediaUrl = null,
                    createdAtMillis = now - 1_000L,
                    syncedAtMillis = now,
                ).toEntity(),
                CachedPost(
                    id = "demo-media-pipeline",
                    authorId = "media-pipeline",
                    authorName = "Media Pipeline",
                    body = "Images and videos will use device cache for smoother playback and lower repeat data usage.",
                    mediaUrl = null,
                    createdAtMillis = now - 2_000L,
                    syncedAtMillis = now,
                ).toEntity(),
            ),
        )
    }

    override suspend fun queueLike(postId: String) {
        queueFeedAction(PendingActionType.LikePost, """{"postId":"$postId"}""")
    }

    override suspend fun queueSave(postId: String) {
        queueFeedAction(PendingActionType.SavePost, """{"postId":"$postId"}""")
    }

    private suspend fun queueFeedAction(type: PendingActionType, payloadJson: String) {
        pendingActionDao.upsertAction(
            PendingAction(
                localId = UUID.randomUUID().toString(),
                type = type,
                payloadJson = payloadJson,
                createdAtMillis = System.currentTimeMillis(),
            ).toEntity(),
        )
        syncScheduler.scheduleImmediateSync()
    }
}
