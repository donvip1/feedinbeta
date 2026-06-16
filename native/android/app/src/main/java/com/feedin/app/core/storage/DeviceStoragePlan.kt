package com.feedin.app.core.storage

enum class DeviceStorageBucket {
    FeedCache,
    ProfileCache,
    MessageCache,
    MediaCache,
    Drafts,
    UploadQueue,
    PendingActions,
}

data class StorageBudget(
    val bucket: DeviceStorageBucket,
    val maxBytes: Long,
    val canEvictAutomatically: Boolean,
)

object FeedinStorageBudgets {
    val defaultBudgets = listOf(
        StorageBudget(DeviceStorageBucket.FeedCache, maxBytes = 250L * 1024L * 1024L, canEvictAutomatically = true),
        StorageBudget(DeviceStorageBucket.ProfileCache, maxBytes = 100L * 1024L * 1024L, canEvictAutomatically = true),
        StorageBudget(DeviceStorageBucket.MessageCache, maxBytes = 500L * 1024L * 1024L, canEvictAutomatically = false),
        StorageBudget(DeviceStorageBucket.MediaCache, maxBytes = 2L * 1024L * 1024L * 1024L, canEvictAutomatically = true),
        StorageBudget(DeviceStorageBucket.Drafts, maxBytes = 500L * 1024L * 1024L, canEvictAutomatically = false),
        StorageBudget(DeviceStorageBucket.UploadQueue, maxBytes = 1L * 1024L * 1024L * 1024L, canEvictAutomatically = false),
        StorageBudget(DeviceStorageBucket.PendingActions, maxBytes = 25L * 1024L * 1024L, canEvictAutomatically = false),
    )
}

