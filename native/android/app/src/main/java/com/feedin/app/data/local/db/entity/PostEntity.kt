package com.feedin.app.data.local.db.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "posts",
    indices = [
        Index(value = ["authorId"]),
        Index(value = ["createdAtMillis"]),
    ],
)
data class PostEntity(
    @PrimaryKey val id: String,
    val authorId: String,
    val authorName: String,
    val body: String,
    val mediaUrl: String?,
    val createdAtMillis: Long,
    val syncedAtMillis: Long,
)

