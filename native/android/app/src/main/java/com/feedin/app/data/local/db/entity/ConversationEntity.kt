package com.feedin.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "conversations",
    indices = [Index(value = ["updatedAtMillis"])],
)
data class ConversationEntity(
    @PrimaryKey val id: String,
    val title: String?,
    val lastMessagePreview: String?,
    val updatedAtMillis: Long,
)

