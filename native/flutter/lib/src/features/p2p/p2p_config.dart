/// P2P marketplace configuration, ported from the web `src/lib/p2p-config.ts`.
///
/// Kept as a self-contained set of constants so the native module owns its own
/// rate/limit/region rules without importing anything cross-feature. All values
/// track the web config; update both together if the product rules change.
class P2PConfig {
  const P2PConfig._();

  // Credit rates.
  /// 100 credits = $1 USD when buying from the store.
  static const int buyRate = 100;

  /// 85 credits = $1 USD when selling on P2P.
  static const int sellRate = 85;

  // Trading limits (credits).
  static const int minTradeFirstTime = 500;
  static const int minTradeRegular = 100;
  static const int maxTradePerTransaction = 1000000;

  // Payment window (minutes).
  static const int defaultPaymentWindow = 30;
  static const int minPaymentWindow = 15;
  static const int maxPaymentWindow = 120;

  // Region / feature flags.
  static const bool internationalEnabled = false;
  static const bool paypalEnabled = false;

  /// Platform fee percentage applied to P2P trades.
  static const double platformFeePercentage = 1;

  static const List<P2PCountry> supportedCountries = [
    P2PCountry(code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦'),
    P2PCountry(code: 'US', name: 'United States', currency: 'USD', symbol: '\$'),
    P2PCountry(
      code: 'GB',
      name: 'United Kingdom',
      currency: 'GBP',
      symbol: '£',
    ),
    P2PCountry(code: 'GH', name: 'Ghana', currency: 'GHS', symbol: '₵'),
    P2PCountry(code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh'),
    P2PCountry(code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R'),
    P2PCountry(code: 'IN', name: 'India', currency: 'INR', symbol: '₹'),
    P2PCountry(code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱'),
  ];

  static const List<String> nigerianBanks = [
    'Access Bank',
    'Citibank Nigeria',
    'Ecobank Nigeria',
    'Fidelity Bank',
    'First Bank of Nigeria',
    'First City Monument Bank (FCMB)',
    'Globus Bank',
    'Guaranty Trust Bank (GTBank)',
    'Heritage Bank',
    'Jaiz Bank',
    'Keystone Bank',
    'Kuda Bank',
    'Moniepoint MFB',
    'Opay',
    'Palmpay',
    'Polaris Bank',
    'Providus Bank',
    'Stanbic IBTC Bank',
    'Standard Chartered Bank',
    'Sterling Bank',
    'SunTrust Bank',
    'Titan Trust Bank',
    'Union Bank of Nigeria',
    'United Bank for Africa (UBA)',
    'Unity Bank',
    'VFD Microfinance Bank',
    'Wema Bank',
    'Zenith Bank',
  ];

  /// USD -> credits when selling (floor).
  static int usdToCreditsForSelling(double usd) => (usd * sellRate).floor();

  /// credits -> USD when selling.
  static double creditsToUsdForSelling(int credits) => credits / sellRate;

  /// USD -> credits when buying from the store (floor).
  static int usdToCreditsForBuying(double usd) => (usd * buyRate).floor();

  /// credits -> USD when buying from the store.
  static double creditsToUsdForBuying(int credits) => credits / buyRate;

  static P2PCountry? countryByCode(String? code) {
    if (code == null) return null;
    for (final c in supportedCountries) {
      if (c.code == code) return c;
    }
    return null;
  }

  static bool isCountrySupported(String? code) => countryByCode(code) != null;
}

/// A supported P2P country with its currency metadata.
class P2PCountry {
  const P2PCountry({
    required this.code,
    required this.name,
    required this.currency,
    required this.symbol,
  });

  final String code;
  final String name;
  final String currency;
  final String symbol;
}
