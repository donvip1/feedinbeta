// P2P Marketplace Configuration
// All rates and limits are defined here for consistency

export const P2P_CONFIG = {
  // Credit rates
  BUY_RATE: 100,      // 100 credits = $1 USD (buying from store)
  SELL_RATE: 85,      // 85 credits = $1 USD (selling on P2P)
  
  // Trading limits
  MIN_TRADE_FIRST_TIME: 500,    // First-time traders must trade 500+ credits
  MIN_TRADE_REGULAR: 100,       // Regular traders can trade 100+ credits
  MAX_TRADE_PER_TRANSACTION: 1000000,
  
  // Payment window defaults (in minutes)
  DEFAULT_PAYMENT_WINDOW: 30,
  MIN_PAYMENT_WINDOW: 15,
  MAX_PAYMENT_WINDOW: 120,
  
  // Region settings
  INTERNATIONAL_ENABLED: false, // Coming soon
  PAYPAL_ENABLED: false,        // Coming soon
  
  // Platform fees (percentage)
  PLATFORM_FEE_PERCENTAGE: 1,   // 1% fee on P2P trades
  
  // Supported countries for P2P trading
  SUPPORTED_COUNTRIES: [
    { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
    { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
    { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: '₵' },
    { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
    { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
    { code: 'IN', name: 'India', currency: 'INR', symbol: '₹' },
    { code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱' },
  ],
  
  // Nigerian banks list
  NIGERIAN_BANKS: [
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
  ],
};

// Helper function to calculate credits from USD (for selling)
export const usdToCreditsForSelling = (usd: number): number => {
  return Math.floor(usd * P2P_CONFIG.SELL_RATE);
};

// Helper function to calculate USD from credits (for selling)
export const creditsToUsdForSelling = (credits: number): number => {
  return credits / P2P_CONFIG.SELL_RATE;
};

// Helper function to calculate credits from USD (for buying from store)
export const usdToCreditsForBuying = (usd: number): number => {
  return Math.floor(usd * P2P_CONFIG.BUY_RATE);
};

// Helper function to calculate USD from credits (for buying from store)
export const creditsToUsdForBuying = (credits: number): number => {
  return credits / P2P_CONFIG.BUY_RATE;
};

// Get country info by code
export const getCountryByCode = (code: string) => {
  return P2P_CONFIG.SUPPORTED_COUNTRIES.find(c => c.code === code);
};

// Check if country is supported for P2P
export const isCountrySupported = (code: string): boolean => {
  return P2P_CONFIG.SUPPORTED_COUNTRIES.some(c => c.code === code);
};
