package com.feedin.app.core.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.feedin.app.data.local.db.FeedinDatabase

class FeedinSyncWorker(
    appContext: Context,
    workerParameters: WorkerParameters,
) : CoroutineWorker(appContext, workerParameters) {
    override suspend fun doWork(): Result {
        val pendingActions = FeedinDatabase
            .create(applicationContext)
            .pendingActionDao()
            .getPendingActions()

        if (pendingActions.isEmpty()) return Result.success()

        // Remote replay is added after Supabase endpoint contracts are finalized.
        return Result.retry()
    }

    companion object {
        const val UniqueImmediateWorkName = "feedin-immediate-sync"
        const val UniqueBackgroundWorkName = "feedin-background-sync"
    }
}

