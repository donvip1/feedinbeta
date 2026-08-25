import 'package:supabase_flutter/supabase_flutter.dart';

import 'currency_models.dart';

class CurrencyRemoteDataSource {
  const CurrencyRemoteDataSource(this._client);

  static const supportedPaystackCurrencies = {
    'USD',
    'NGN',
    'GHS',
    'KES',
    'ZAR',
  };

  final SupabaseClient _client;

  Future<CurrencyQuote> fetchPreferredQuote(String userId) async {
    final profile = await _client
        .from('profiles')
        .select('preferred_currency')
        .eq('id', userId)
        .maybeSingle();
    final code = profile?['preferred_currency']?.toString().toUpperCase();
    if (code == null || !supportedPaystackCurrencies.contains(code)) {
      return CurrencyQuote.usd;
    }
    if (code == 'USD') return CurrencyQuote.usd;

    final row = await _client
        .from('currency_rates')
        .select('currency_code, currency_symbol, rate_to_usd, updated_at')
        .eq('currency_code', code)
        .eq('is_active', true)
        .maybeSingle();
    if (row == null) return CurrencyQuote.usd;

    final rate = switch (row['rate_to_usd']) {
      num value => value.toDouble(),
      String value => double.tryParse(value),
      _ => null,
    };
    final updatedAt = DateTime.tryParse(row['updated_at']?.toString() ?? '');
    if (rate == null || !rate.isFinite || rate <= 0 || updatedAt == null) {
      return CurrencyQuote.usd;
    }
    return CurrencyQuote(
      currencyCode: code,
      currencySymbol: row['currency_symbol']?.toString() ?? code,
      ratePerUsd: rate,
      updatedAtMillis: updatedAt.millisecondsSinceEpoch,
    );
  }
}
