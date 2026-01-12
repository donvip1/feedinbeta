// Location detection and currency mapping service

export interface LocationData {
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
  currency: string;
  latitude?: number;
  longitude?: number;
}

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
  lat: number;
  lon: number;
}

// Country code to currency mapping
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Americas
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', 
  CO: 'COP', PE: 'PEN', EC: 'USD', VE: 'USD', PA: 'USD', SV: 'USD',
  
  // Europe
  GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR',
  CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'EUR',
  RO: 'EUR', HU: 'EUR', UA: 'UAH', RU: 'RUB', TR: 'TRY',
  
  // Africa
  NG: 'NGN', ZA: 'ZAR', KE: 'KES', GH: 'GHS', EG: 'EGP', MA: 'MAD',
  TZ: 'TZS', UG: 'UGX', RW: 'RWF', ET: 'ETB',
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', NE: 'XOF', TG: 'XOF', BJ: 'XOF',
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  
  // Asia
  JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', PK: 'PKR', BD: 'BDT',
  ID: 'IDR', MY: 'MYR', SG: 'SGD', PH: 'PHP', TH: 'THB', VN: 'VND',
  HK: 'HKD', TW: 'TWD', AE: 'AED', SA: 'SAR', IL: 'USD',
  
  // Oceania
  AU: 'AUD', NZ: 'NZD',
};

// Get country flag emoji from country code
export const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Get currency for a country
export const getCurrencyForCountry = (countryCode: string): string => {
  return COUNTRY_CURRENCY_MAP[countryCode?.toUpperCase()] || 'USD';
};

// Cache key for localStorage
const LOCATION_CACHE_KEY = 'feedin_user_location';
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Get cached location
const getCachedLocation = (): LocationData | null => {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < LOCATION_CACHE_DURATION) {
        return data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
};

// Cache location
const cacheLocation = (data: LocationData): void => {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore cache errors
  }
};

// Detect location using IP-based geolocation
export const detectUserLocation = async (): Promise<LocationData> => {
  // Check cache first
  const cached = getCachedLocation();
  if (cached) {
    return cached;
  }

  try {
    // Use ip-api.com (free, no API key needed, 45 requests/minute limit)
    const response = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,city,timezone,lat,lon');
    
    if (!response.ok) {
      throw new Error('IP geolocation failed');
    }

    const data: IpApiResponse = await response.json();

    if (data.status !== 'success') {
      throw new Error('IP geolocation returned error status');
    }

    const locationData: LocationData = {
      country: data.country,
      countryCode: data.countryCode,
      city: data.city,
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: getCurrencyForCountry(data.countryCode),
      latitude: data.lat,
      longitude: data.lon,
    };

    cacheLocation(locationData);
    return locationData;
  } catch (error) {
    console.warn('IP geolocation failed, using fallback:', error);
    
    // Fallback: try to detect timezone at least
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Basic timezone to country mapping for common cases
    const timezoneCountryMap: Record<string, string> = {
      'Africa/Lagos': 'NG',
      'Africa/Johannesburg': 'ZA',
      'Africa/Nairobi': 'KE',
      'Africa/Accra': 'GH',
      'Africa/Cairo': 'EG',
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'America/Toronto': 'CA',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Kolkata': 'IN',
      'Asia/Dubai': 'AE',
      'Australia/Sydney': 'AU',
    };

    const countryCode = timezoneCountryMap[timezone] || 'US';
    
    const fallbackData: LocationData = {
      country: countryCode === 'US' ? 'United States' : countryCode,
      countryCode,
      city: '',
      timezone,
      currency: getCurrencyForCountry(countryCode),
    };

    cacheLocation(fallbackData);
    return fallbackData;
  }
};

// Get location using browser's Geolocation API (requires user permission)
export const detectPreciseLocation = async (): Promise<LocationData | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use reverse geocoding to get country
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          
          if (response.ok) {
            const data = await response.json();
            const countryCode = data.address?.country_code?.toUpperCase() || 'US';
            
            const locationData: LocationData = {
              country: data.address?.country || 'Unknown',
              countryCode,
              city: data.address?.city || data.address?.town || data.address?.village || '',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              currency: getCurrencyForCountry(countryCode),
              latitude,
              longitude,
            };
            
            cacheLocation(locationData);
            resolve(locationData);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      },
      () => {
        resolve(null);
      },
      { timeout: 10000, maximumAge: 3600000 }
    );
  });
};

// Clear cached location
export const clearLocationCache = (): void => {
  localStorage.removeItem(LOCATION_CACHE_KEY);
};
