import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, MapPin, RefreshCw, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useCurrency } from '@/context/CurrencyContext';
import { getCountryFlag } from '@/lib/location-service';
import { BottomNav } from '@/components/navigation/BottomNav';

const CurrencySettings = () => {
  const navigate = useNavigate();
  const {
    currentCurrency,
    currencySymbol,
    currencyName,
    exchangeRate,
    availableCurrencies,
    userLocation,
    setCurrency,
    detectAndSetLocation,
    formatPrice,
    formatCreditsValue,
  } = useCurrency();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const filteredCurrencies = availableCurrencies.filter(currency =>
    currency.currency_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    currency.currency_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDetectLocation = async () => {
    setIsDetecting(true);
    try {
      const location = await detectAndSetLocation();
      if (location) {
        toast.success(`Location detected: ${location.city ? location.city + ', ' : ''}${location.country}`);
      } else {
        toast.error('Could not detect your location');
      }
    } catch {
      toast.error('Failed to detect location');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCurrencyChange = async (currencyCode: string) => {
    if (currencyCode === currentCurrency) return;
    
    setIsChanging(true);
    try {
      await setCurrency(currencyCode);
      toast.success(`Currency changed to ${currencyCode}`);
    } catch {
      toast.error('Failed to change currency');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Currency & Location</h1>
            <p className="text-sm text-muted-foreground">Set your preferred currency</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Current Location */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Your Location</p>
                {userLocation ? (
                  <p className="text-sm text-muted-foreground">
                    {getCountryFlag(userLocation.countryCode)}{' '}
                    {userLocation.city ? `${userLocation.city}, ` : ''}
                    {userLocation.country}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not detected</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetectLocation}
              disabled={isDetecting}
            >
              {isDetecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Detect</span>
            </Button>
          </div>
        </Card>

        {/* Current Currency */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Current Currency</p>
              <p className="text-sm text-muted-foreground">
                {currencySymbol} {currencyName} ({currentCurrency})
              </p>
            </div>
          </div>
          
          {/* Conversion Preview */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Conversion Preview</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">100 credits =</p>
                <p className="font-semibold">{formatCreditsValue(100)} ({formatPrice(1)})</p>
              </div>
              <div>
                <p className="text-muted-foreground">1,000 credits =</p>
                <p className="font-semibold">{formatCreditsValue(1000)} ({formatPrice(10)})</p>
              </div>
            </div>
            {currentCurrency !== 'USD' && (
              <p className="text-xs text-muted-foreground mt-2">
                Exchange rate: 1 USD = {currencySymbol}{exchangeRate.toLocaleString()}
              </p>
            )}
          </div>
        </Card>

        {/* Currency Selection */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Select Currency</h2>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search currencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Currency List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredCurrencies.map((currency) => {
              const isSelected = currency.currency_code === currentCurrency;
              const countryCode = currency.country_codes?.[0] || '';
              
              return (
                <button
                  key={currency.id}
                  onClick={() => handleCurrencyChange(currency.currency_code)}
                  disabled={isChanging}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCountryFlag(countryCode)}</span>
                    <div className="text-left">
                      <p className="font-medium">
                        {currency.currency_code} - {currency.currency_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currency.currency_symbol}1 = ${(1 / currency.rate_to_usd).toFixed(4)} USD
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}

            {filteredCurrencies.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No currencies found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <Card className="p-4 bg-muted/30 border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Currency conversion is for display purposes. All transactions are processed in credits, 
            where 100 credits = $1 USD. Exchange rates are updated periodically and may vary.
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default CurrencySettings;
