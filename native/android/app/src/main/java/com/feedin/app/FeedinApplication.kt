package com.feedin.app

import android.app.Application

class FeedinApplication : Application() {
    lateinit var appContainer: FeedinAppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        appContainer = FeedinAppContainer(this)
    }
}
