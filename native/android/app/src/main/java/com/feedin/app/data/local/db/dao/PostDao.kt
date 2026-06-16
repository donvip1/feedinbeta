package com.feedin.app.data.local.db.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.feedin.app.data.local.db.entity.PostEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PostDao {
    @Query("SELECT * FROM posts ORDER BY createdAtMillis DESC")
    fun observeFeed(): Flow<List<PostEntity>>

    @Query("SELECT COUNT(*) FROM posts")
    suspend fun countPosts(): Int

    @Upsert
    suspend fun upsertPosts(posts: List<PostEntity>)

    @Query("DELETE FROM posts WHERE id = :postId")
    suspend fun deletePost(postId: String)
}
