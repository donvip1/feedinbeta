package com.feedin.app.data.local.db.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.feedin.app.data.local.db.entity.PendingActionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingActionDao {
    @Query("SELECT * FROM pending_actions ORDER BY createdAtMillis ASC")
    fun observePendingActions(): Flow<List<PendingActionEntity>>

    @Query("SELECT * FROM pending_actions ORDER BY createdAtMillis ASC")
    suspend fun getPendingActions(): List<PendingActionEntity>

    @Upsert
    suspend fun upsertAction(action: PendingActionEntity)

    @Query("UPDATE pending_actions SET retryCount = retryCount + 1 WHERE localId = :localId")
    suspend fun incrementRetry(localId: String)

    @Query("DELETE FROM pending_actions WHERE localId = :localId")
    suspend fun deleteAction(localId: String)
}

