package com.feedin.app.core.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class WorkManagerSyncScheduler(context: Context) : SyncScheduler {
    private val workManager = WorkManager.getInstance(context.applicationContext)
    private val connectedConstraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    override fun scheduleImmediateSync() {
        val request = OneTimeWorkRequestBuilder<FeedinSyncWorker>()
            .setConstraints(connectedConstraints)
            .build()

        workManager.enqueueUniqueWork(
            FeedinSyncWorker.UniqueImmediateWorkName,
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    override fun scheduleBackgroundSync() {
        val request = PeriodicWorkRequestBuilder<FeedinSyncWorker>(
            15,
            TimeUnit.MINUTES,
        )
            .setConstraints(connectedConstraints)
            .build()

        workManager.enqueueUniquePeriodicWork(
            FeedinSyncWorker.UniqueBackgroundWorkName,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }
}

