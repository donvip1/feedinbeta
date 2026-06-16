package com.feedin.app.core.config

import com.feedin.app.BuildConfig

data class FeedinConfig(
    val supabaseUrl: String,
    val supabaseAnonKey: String,
) {
    val isConfigured: Boolean
        get() = supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()

    companion object {
        fun fromBuildConfig(): FeedinConfig = FeedinConfig(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
}

