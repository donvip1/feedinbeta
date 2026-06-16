package com.feedin.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.feedin.app.core.sync.PendingActionType

@Entity(
    tableName = "pending_actions",
    indices = [
        Index(value = ["type"]),
        Index(value = ["createdAtMillis"]),
    ],
)
data class PendingActionEntity(
    @PrimaryKey val localId: String,
    val type: PendingActionType,
    val payloadJson: String,
    val createdAtMillis: Long,
    val retryCount: Int,
)

