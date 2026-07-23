/// A typed success/failure result used across the communication platform so
/// services never throw for expected failures and callers must handle both
/// arms. Pure Dart.
sealed class Result<T> {
  const Result();

  bool get isOk => this is Ok<T>;
  bool get isErr => this is Err<T>;

  /// The value if [Ok], else null.
  T? get valueOrNull => switch (this) {
    Ok<T>(:final value) => value,
    Err<T>() => null,
  };

  /// The error if [Err], else null.
  CommError? get errorOrNull => switch (this) {
    Ok<T>() => null,
    Err<T>(:final error) => error,
  };

  R fold<R>(R Function(T value) onOk, R Function(CommError error) onErr) =>
      switch (this) {
        Ok<T>(:final value) => onOk(value),
        Err<T>(:final error) => onErr(error),
      };
}

class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

class Err<T> extends Result<T> {
  const Err(this.error);
  final CommError error;
}

/// A structured, non-throwing error with a machine-readable [kind] and a
/// [isTransient] flag that the outbox uses to decide retry vs dead-letter.
class CommError {
  const CommError({
    required this.kind,
    required this.message,
    this.isTransient = false,
    this.cause,
  });

  final CommErrorKind kind;
  final String message;
  final bool isTransient;
  final Object? cause;

  factory CommError.network(String message, {Object? cause}) => CommError(
    kind: CommErrorKind.network,
    message: message,
    isTransient: true,
    cause: cause,
  );

  factory CommError.validation(String message) =>
      CommError(kind: CommErrorKind.validation, message: message);

  factory CommError.permission(String message) =>
      CommError(kind: CommErrorKind.permission, message: message);

  factory CommError.unauthorized(String message) =>
      CommError(kind: CommErrorKind.unauthorized, message: message);

  factory CommError.notFound(String message) =>
      CommError(kind: CommErrorKind.notFound, message: message);

  factory CommError.conflict(String message) =>
      CommError(kind: CommErrorKind.conflict, message: message, isTransient: true);

  factory CommError.unknown(String message, {Object? cause}) => CommError(
    kind: CommErrorKind.unknown,
    message: message,
    isTransient: true,
    cause: cause,
  );

  @override
  String toString() => 'CommError(${kind.name}: $message)';
}

enum CommErrorKind {
  network,
  permission,
  validation,
  notFound,
  conflict,
  unauthorized,
  unknown,
}
