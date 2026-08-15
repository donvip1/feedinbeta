class CurrencyQuote {
  const CurrencyQuote({
    required this.currencyCode,
    required this.currencySymbol,
    required this.ratePerUsd,
    required this.updatedAtMillis,
  });

  static const usd = CurrencyQuote(
    currencyCode: 'USD',
    currencySymbol: r'$',
    ratePerUsd: 1,
    updatedAtMillis: 0,
  );

  final String currencyCode;
  final String currencySymbol;
  final double ratePerUsd;
  final int updatedAtMillis;

  bool get isUsd => currencyCode == 'USD';

  String get rateTimestampLabel {
    if (isUsd || updatedAtMillis <= 0) return 'USD base rate';
    final date = DateTime.fromMillisecondsSinceEpoch(updatedAtMillis).toLocal();
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return 'Rate updated ${date.year}-$month-$day';
  }

  int localMinorFromUsdMinor(int usdMinor) => (usdMinor * ratePerUsd).round();
}

class CurrencyDisplayPrice {
  const CurrencyDisplayPrice({
    required this.primaryLabel,
    this.canonicalLabel,
  });

  final String primaryLabel;
  final String? canonicalLabel;

  factory CurrencyDisplayPrice.fromUsdMinor(
    int usdMinor,
    CurrencyQuote quote,
  ) {
    final usdLabel = _formatMinor(usdMinor, r'$', alwaysShowDecimals: true);
    if (quote.isUsd) {
      return CurrencyDisplayPrice(primaryLabel: usdLabel);
    }
    return CurrencyDisplayPrice(
      primaryLabel: _formatMinor(
        quote.localMinorFromUsdMinor(usdMinor),
        quote.currencySymbol,
      ),
      canonicalLabel: '$usdLabel USD equivalent',
    );
  }
}

String _formatMinor(
  int minor,
  String symbol, {
  bool alwaysShowDecimals = false,
}) {
  final absoluteMinor = minor.abs();
  final whole = absoluteMinor ~/ 100;
  final fraction = absoluteMinor % 100;
  final groupedWhole = _groupThousands(whole);
  final sign = minor < 0 ? '-' : '';
  final decimals = alwaysShowDecimals || fraction != 0
      ? '.${fraction.toString().padLeft(2, '0')}'
      : '';
  return '$sign$symbol$groupedWhole$decimals';
}

String _groupThousands(int value) {
  final digits = value.toString();
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write(',');
    buffer.write(digits[index]);
  }
  return buffer.toString();
}
