package com.feedin.app.data.remote

/**
 * Privileged operations must go through server-side validation before they are
 * reflected in local cache.
 */
enum class ServerOwnedOperation {
    PaymentCheckout,
    CreditDeduction,
    PayoutRequest,
    AdminAction,
    ModerationAction,
    AiProviderCall,
    UploadAuthorization,
    PushFanout,
}

data class ApiResult<T>(
    val data: T?,
    val errorMessage: String? = null,
) {
    val isSuccess: Boolean
        get() = errorMessage == null
}

