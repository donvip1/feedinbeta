import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExchangeRateResponse {
  [key: string]: number;
}

interface BybitTickerResponse {
  retCode: number;
  result: {
    list: Array<{
      symbol: string;
      lastPrice: string;
    }>;
  };
}

// Fetch rates from ExchangeRate-API (free tier)
async function fetchExchangeRates(): Promise<ExchangeRateResponse | null> {
  try {
    // Using exchangerate.host - free, no API key required
    const response = await fetch('https://api.exchangerate.host/latest?base=USD');
    if (!response.ok) {
      console.error('exchangerate.host failed:', response.status);
      return null;
    }
    const data = await response.json();
    return data.rates || null;
  } catch (error) {
    console.error('Error fetching from exchangerate.host:', error);
    return null;
  }
}

// Fetch rates from Open Exchange Rates (fallback)
async function fetchOpenExchangeRates(): Promise<ExchangeRateResponse | null> {
  try {
    // Using frankfurter.app - free, no API key required
    const response = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!response.ok) {
      console.error('frankfurter.app failed:', response.status);
      return null;
    }
    const data = await response.json();
    return data.rates || null;
  } catch (error) {
    console.error('Error fetching from frankfurter.app:', error);
    return null;
  }
}

// Fetch USDT/NGN rate from Bybit P2P market data
async function fetchBybitNGNRate(): Promise<number | null> {
  try {
    // Bybit spot ticker for USDT pairs - we'll use their public API
    // For P2P rates, we'll estimate based on market data
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=USDTNGN');
    
    if (!response.ok) {
      // Bybit might not have direct USDTNGN, try alternative approach
      console.log('Direct USDTNGN not available, using P2P estimation');
      return await fetchBybitP2PRate();
    }
    
    const data: BybitTickerResponse = await response.json();
    
    if (data.retCode === 0 && data.result?.list?.length > 0) {
      return parseFloat(data.result.list[0].lastPrice);
    }
    
    return await fetchBybitP2PRate();
  } catch (error) {
    console.error('Error fetching Bybit NGN rate:', error);
    return null;
  }
}

// Fetch P2P rate estimation from Bybit
async function fetchBybitP2PRate(): Promise<number | null> {
  try {
    // Bybit P2P API - get NGN buy rates
    const response = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenId: 'USDT',
        currencyId: 'NGN',
        side: '1', // Buy side
        size: '10',
        page: '1',
        amount: '',
        authMaker: false,
        canTrade: false,
      }),
    });

    if (!response.ok) {
      console.error('Bybit P2P API failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.ret_code === 0 && data.result?.items?.length > 0) {
      // Get average of top 5 P2P rates
      const rates = data.result.items.slice(0, 5).map((item: any) => parseFloat(item.price));
      const avgRate = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
      console.log('Bybit P2P NGN rate:', avgRate);
      return avgRate;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Bybit P2P rate:', error);
    return null;
  }
}

// Fetch rates from multiple sources for accuracy
async function fetchMultiSourceRates(): Promise<ExchangeRateResponse> {
  // Try multiple sources in order of preference
  let rates = await fetchExchangeRates();
  
  if (!rates) {
    console.log('Primary source failed, trying fallback...');
    rates = await fetchOpenExchangeRates();
  }
  
  if (!rates) {
    console.log('All sources failed, using cached/default rates');
    // Return minimal default rates if all APIs fail
    return {
      USD: 1,
      NGN: 1600,
      EUR: 0.92,
      GBP: 0.79,
    };
  }
  
  // Try to get Bybit NGN rate for more accurate Nigerian Naira pricing
  const bybitNGNRate = await fetchBybitNGNRate();
  if (bybitNGNRate && bybitNGNRate > 0) {
    console.log('Using Bybit NGN rate:', bybitNGNRate);
    rates.NGN = bybitNGNRate;
  }
  
  return rates;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Fetching latest exchange rates...');
    
    // Fetch rates from multiple sources
    const rates = await fetchMultiSourceRates();
    
    // Get existing currencies from database
    const { data: existingCurrencies, error: fetchError } = await supabase
      .from('currency_rates')
      .select('currency_code');
    
    if (fetchError) {
      throw new Error(`Failed to fetch existing currencies: ${fetchError.message}`);
    }
    
    const existingCodes = new Set(existingCurrencies?.map(c => c.currency_code) || []);
    const updates: Array<{ currency_code: string; rate_to_usd: number }> = [];
    
    // Map of currency codes we support
    const supportedCurrencies = [
      'USD', 'NGN', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'KES', 'GHS', 'ZAR', 
      'JPY', 'CNY', 'BRL', 'MXN', 'AED', 'SAR', 'EGP', 'PKR', 'BDT', 'PHP',
      'IDR', 'THB', 'VND', 'MYR', 'SGD', 'HKD', 'KRW', 'TRY', 'RUB', 'PLN',
      'CZK', 'HUF', 'SEK', 'NOK', 'DKK', 'CHF', 'NZD', 'CLP', 'COP', 'PEN',
      'ARS', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'MAD', 'TND', 'DZD', 'LYD'
    ];
    
    // Prepare updates for currencies that exist in our database
    for (const code of supportedCurrencies) {
      if (rates[code] && existingCodes.has(code)) {
        updates.push({
          currency_code: code,
          rate_to_usd: rates[code],
        });
      }
    }
    
    // Update rates in database
    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('currency_rates')
        .update({ 
          rate_to_usd: update.rate_to_usd,
          updated_at: new Date().toISOString(),
        })
        .eq('currency_code', update.currency_code);
      
      if (!updateError) {
        updatedCount++;
      } else {
        console.error(`Failed to update ${update.currency_code}:`, updateError);
      }
    }
    
    const response = {
      success: true,
      message: `Updated ${updatedCount} currency rates`,
      timestamp: new Date().toISOString(),
      rates: {
        NGN: rates.NGN,
        EUR: rates.EUR,
        GBP: rates.GBP,
        source: 'multi-source with Bybit P2P for NGN',
      },
    };
    
    console.log('Exchange rates updated:', response);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating exchange rates:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
