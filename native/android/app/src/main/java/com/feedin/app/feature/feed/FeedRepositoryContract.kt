package com.feedin.app.feature.feed

import com.feedin.app.data.local.CachedPost
import kotlinx.coroutines.flow.Flow

interface FeedRepositoryContract {
    suspend fun refreshFeed()
    fun observeCachedFeed(): Flow<List<CachedPost>>
    suspend fun queueLike(postId: String)
    suspend fun queueSave(postId: String)
}
