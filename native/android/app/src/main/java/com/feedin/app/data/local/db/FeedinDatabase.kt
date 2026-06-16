package com.feedin.app.data.local.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.feedin.app.data.local.db.dao.ConversationDao
import com.feedin.app.data.local.db.dao.MessageDao
import com.feedin.app.data.local.db.dao.PendingActionDao
import com.feedin.app.data.local.db.dao.PostDao
import com.feedin.app.data.local.db.entity.ConversationEntity
import com.feedin.app.data.local.db.entity.MessageEntity
import com.feedin.app.data.local.db.entity.PendingActionEntity
import com.feedin.app.data.local.db.entity.PostEntity

@Database(
    entities = [
        PostEntity::class,
        ConversationEntity::class,
        MessageEntity::class,
        PendingActionEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
@TypeConverters(FeedinTypeConverters::class)
abstract class FeedinDatabase : RoomDatabase() {
    abstract fun postDao(): PostDao
    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao
    abstract fun pendingActionDao(): PendingActionDao

    companion object {
        const val DatabaseName = "feedin.db"

        fun create(context: Context): FeedinDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                FeedinDatabase::class.java,
                DatabaseName,
            ).build()
    }
}

