package com.feedin.app.data.local.db

import androidx.room.TypeConverter
import com.feedin.app.core.sync.PendingActionType
import com.feedin.app.data.local.MessageDeliveryState

class FeedinTypeConverters {
    @TypeConverter
    fun messageDeliveryStateToString(value: MessageDeliveryState): String = value.name

    @TypeConverter
    fun stringToMessageDeliveryState(value: String): MessageDeliveryState =
        MessageDeliveryState.valueOf(value)

    @TypeConverter
    fun pendingActionTypeToString(value: PendingActionType): String = value.name

    @TypeConverter
    fun stringToPendingActionType(value: String): PendingActionType =
        PendingActionType.valueOf(value)
}

