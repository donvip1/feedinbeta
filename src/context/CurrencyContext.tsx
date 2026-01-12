import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { detectUserLocation, LocationData, getCurrencyForCountry } from '@/lib/location-service';

export interface CurrencyRate {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  rate_to_usd: number;
  country_codes: string[];
  is_active: boolean;
  updated_at?: string;
}

interface CurrencyContextType {
  currentCurrency: string;
  currencySymbol: string;
  currencyName: string;
  exchangeRate: number;
  availableCurrencies: CurrencyRate[];
  userLocation: LocationData | null;
  loading: boolean;
  lastRateUpdate: Date | null;
  setCurrency: (currencyCode: string) => Promise<void>;
  convertFromUSD: (usdAmount: number) => number;
  convertToUSD: (localAmount: number) => number;
  formatPrice: (usdAmount: number, showSymbol?: boolean) => string;
  formatCreditsValue: (credits: number, showSymbol?: boolean) => string;
  refreshRates: () => Promise<void>;
  detectAndSetLocation: () => Promise<LocationData | null>;
}

const CREDITS_PER_USD = 100;
const RATE_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentCurrency, setCurrentCurrency] = useState('USD');
  const [availableCurrencies, setAvailableCurrencies] = useState<CurrencyRate[]>([]);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);

  // Get current currency data
  const currentCurrencyData = availableCurrencies.find(c => c.currency_code === currentCurrency);
  const currencySymbol = currentCurrencyData?.currency_symbol || '$';
  const currencyName = currentCurrencyData?.currency_name || 'US Dollar';
  const exchangeRate = currentCurrencyData?.rate_to_usd || 1;

  // Fetch live rates from edge function
  const fetchLiveRates = useCallback(async () => {
    try {
      console.log('Fetching live exchange rates...');
      const { data, error } = await supabase.functions.invoke('update-exchange-rates');
      
      if (error) {
        console.error('Failed to fetch live rates:', error);
        return false;
      }
      
      console.log('Live rates response:', data);
      return data?.success || false;
    } catch (error) {
      console.error('Error calling exchange rate function:', error);
      return false;
    }
  }, []);

  // Fetch currency rates from database
  const fetchCurrencyRates = useCallback(async (triggerLiveUpdate = false) => {
    try {
      // Optionally trigger live rate update first
      if (triggerLiveUpdate) {
        await fetchLiveRates();
      }

      const { data, error } = await supabase
        .from('currency_rates')
        .select('*')
        .eq('is_active', true)
        .order('currency_name');

      if (error) throw error;
      
      setAvailableCurrencies(data || []);
      
      // Track last update time
      if (data && data.length > 0) {
        const mostRecent = data.reduce((latest, curr) => {
          const currDate = curr.updated_at ? new Date(curr.updated_at) : new Date(0);
          return currDate > latest ? currDate : latest;
        }, new Date(0));
        setLastRateUpdate(mostRecent);
      }
    } catch (error) {
      console.error('Failed to fetch currency rates:', error);
      // Set default USD if fetch fails
      setAvailableCurrencies([{
        id: 'default',
        currency_code: 'USD',
        currency_name: 'US Dollar',
        currency_symbol: '$',
        rate_to_usd: 1,
        country_codes: ['US'],
        is_active: true,
      }]);
    }
  }, [fetchLiveRates]);

  // Load user's preferred currency from profile
  const loadUserCurrency = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('preferred_currency, detected_country_code, city, timezone, location')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile?.preferred_currency) {
        setCurrentCurrency(profile.preferred_currency);
      }

      if (profile?.detected_country_code) {
        setUserLocation({
          countryCode: profile.detected_country_code,
          country: profile.location || '',
          city: profile.city || '',
          timezone: profile.timezone || '',
          currency: profile.preferred_currency || getCurrencyForCountry(profile.detected_country_code),
        });
      }
    } catch (error) {
      console.error('Failed to load user currency preference:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Detect location and set currency
  const detectAndSetLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      const location = await detectUserLocation();
      setUserLocation(location);

      // If user is logged in and doesn't have a preferred currency, set it based on location
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_currency')
          .eq('id', user.id)
          .single();

        // Only auto-set if user hasn't manually chosen a currency
        if (!profile?.preferred_currency || profile.preferred_currency === 'USD') {
          await supabase
            .from('profiles')
            .update({
              preferred_currency: location.currency,
              detected_country_code: location.countryCode,
              city: location.city,
              timezone: location.timezone,
              location: `${location.city ? location.city + ', ' : ''}${location.country}`,
            })
            .eq('id', user.id);

          setCurrentCurrency(location.currency);
        }
      } else {
        // For non-logged-in users, just set the currency based on location
        setCurrentCurrency(location.currency);
      }

      return location;
    } catch (error) {
      console.error('Failed to detect location:', error);
      return null;
    }
  }, [user]);

  // Set currency preference
  const setCurrency = useCallback(async (currencyCode: string) => {
    setCurrentCurrency(currencyCode);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_currency: currencyCode })
          .eq('id', user.id);
      } catch (error) {
        console.error('Failed to save currency preference:', error);
      }
    }
  }, [user]);

  // Convert USD to local currency
  const convertFromUSD = useCallback((usdAmount: number): number => {
    return usdAmount * exchangeRate;
  }, [exchangeRate]);

  // Convert local currency to USD
  const convertToUSD = useCallback((localAmount: number): number => {
    return localAmount / exchangeRate;
  }, [exchangeRate]);

  // Format price in local currency
  const formatPrice = useCallback((usdAmount: number, showSymbol = true): string => {
    const localAmount = usdAmount * exchangeRate;
    
    // Format based on currency
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: localAmount < 10 ? 2 : 0,
      maximumFractionDigits: localAmount < 10 ? 2 : 0,
    }).format(localAmount);

    return showSymbol ? `${currencySymbol}${formatted}` : formatted;
  }, [exchangeRate, currencySymbol]);

  // Format credits value in local currency (100 credits = $1)
  const formatCreditsValue = useCallback((credits: number, showSymbol = true): string => {
    const usdValue = credits / CREDITS_PER_USD;
    return formatPrice(usdValue, showSymbol);
  }, [formatPrice]);

  // Refresh rates with live data
  const refreshRates = useCallback(async () => {
    await fetchCurrencyRates(true);
  }, [fetchCurrencyRates]);

  // Initialize on mount - fetch rates and trigger live update
  useEffect(() => {
    fetchCurrencyRates(true);
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchCurrencyRates(true);
    }, RATE_REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchCurrencyRates]);

  // Load user currency when user changes
  useEffect(() => {
    loadUserCurrency();
  }, [loadUserCurrency]);

  // Auto-detect location for new users or users without location
  useEffect(() => {
    if (!loading && user && !userLocation) {
      detectAndSetLocation();
    }
  }, [loading, user, userLocation, detectAndSetLocation]);

  const value: CurrencyContextType = {
    currentCurrency,
    currencySymbol,
    currencyName,
    exchangeRate,
    availableCurrencies,
    userLocation,
    loading,
    lastRateUpdate,
    setCurrency,
    convertFromUSD,
    convertToUSD,
    formatPrice,
    formatCreditsValue,
    refreshRates,
    detectAndSetLocation,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};
