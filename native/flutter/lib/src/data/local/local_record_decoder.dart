typedef JsonFactory<T> = T Function(Map<String, Object?> json);

T? decodeLocalRecord<T>(Object? value, JsonFactory<T> factory) {
  if (value is! Map) return null;

  try {
    return factory(Map<String, Object?>.from(value));
  } catch (_) {
    return null;
  }
}
