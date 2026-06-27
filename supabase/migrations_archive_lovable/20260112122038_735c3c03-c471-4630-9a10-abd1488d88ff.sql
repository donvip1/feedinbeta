-- Create currency_rates table for exchange rate management
CREATE TABLE public.currency_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL UNIQUE,
  currency_name TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  rate_to_usd DECIMAL(12, 6) NOT NULL DEFAULT 1.0,
  country_codes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- Anyone can read currency rates (public data)
CREATE POLICY "Currency rates are publicly readable"
ON public.currency_rates
FOR SELECT
USING (true);

-- Only admins can modify (we'll handle this via service role in edge functions)
CREATE POLICY "Service role can manage currency rates"
ON public.currency_rates
FOR ALL
USING (auth.role() = 'service_role');

-- Insert common currencies with exchange rates
INSERT INTO public.currency_rates (currency_code, currency_name, currency_symbol, rate_to_usd, country_codes) VALUES
('USD', 'US Dollar', '$', 1.0, ARRAY['US', 'EC', 'SV', 'PA']),
('NGN', 'Nigerian Naira', '₦', 1600.0, ARRAY['NG']),
('EUR', 'Euro', '€', 0.92, ARRAY['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI']),
('GBP', 'British Pound', '£', 0.79, ARRAY['GB']),
('CAD', 'Canadian Dollar', 'C$', 1.36, ARRAY['CA']),
('AUD', 'Australian Dollar', 'A$', 1.53, ARRAY['AU']),
('INR', 'Indian Rupee', '₹', 83.0, ARRAY['IN']),
('KES', 'Kenyan Shilling', 'KSh', 153.0, ARRAY['KE']),
('GHS', 'Ghanaian Cedi', '₵', 15.5, ARRAY['GH']),
('ZAR', 'South African Rand', 'R', 18.5, ARRAY['ZA']),
('JPY', 'Japanese Yen', '¥', 149.0, ARRAY['JP']),
('CNY', 'Chinese Yuan', '¥', 7.24, ARRAY['CN']),
('BRL', 'Brazilian Real', 'R$', 4.97, ARRAY['BR']),
('MXN', 'Mexican Peso', 'MX$', 17.15, ARRAY['MX']),
('AED', 'UAE Dirham', 'د.إ', 3.67, ARRAY['AE']),
('SAR', 'Saudi Riyal', '﷼', 3.75, ARRAY['SA']),
('EGP', 'Egyptian Pound', 'E£', 30.9, ARRAY['EG']),
('PKR', 'Pakistani Rupee', '₨', 278.0, ARRAY['PK']),
('BDT', 'Bangladeshi Taka', '৳', 110.0, ARRAY['BD']),
('IDR', 'Indonesian Rupiah', 'Rp', 15700.0, ARRAY['ID']),
('MYR', 'Malaysian Ringgit', 'RM', 4.47, ARRAY['MY']),
('PHP', 'Philippine Peso', '₱', 56.0, ARRAY['PH']),
('THB', 'Thai Baht', '฿', 35.5, ARRAY['TH']),
('VND', 'Vietnamese Dong', '₫', 24500.0, ARRAY['VN']),
('KRW', 'South Korean Won', '₩', 1320.0, ARRAY['KR']),
('SGD', 'Singapore Dollar', 'S$', 1.34, ARRAY['SG']),
('HKD', 'Hong Kong Dollar', 'HK$', 7.82, ARRAY['HK']),
('TWD', 'Taiwan Dollar', 'NT$', 31.5, ARRAY['TW']),
('NZD', 'New Zealand Dollar', 'NZ$', 1.62, ARRAY['NZ']),
('CHF', 'Swiss Franc', 'CHF', 0.88, ARRAY['CH']),
('SEK', 'Swedish Krona', 'kr', 10.5, ARRAY['SE']),
('NOK', 'Norwegian Krone', 'kr', 10.8, ARRAY['NO']),
('DKK', 'Danish Krone', 'kr', 6.87, ARRAY['DK']),
('PLN', 'Polish Zloty', 'zł', 4.02, ARRAY['PL']),
('TRY', 'Turkish Lira', '₺', 32.0, ARRAY['TR']),
('RUB', 'Russian Ruble', '₽', 92.0, ARRAY['RU']),
('UAH', 'Ukrainian Hryvnia', '₴', 41.0, ARRAY['UA']),
('COP', 'Colombian Peso', 'COL$', 3950.0, ARRAY['CO']),
('ARS', 'Argentine Peso', 'ARS$', 870.0, ARRAY['AR']),
('CLP', 'Chilean Peso', 'CLP$', 950.0, ARRAY['CL']),
('PEN', 'Peruvian Sol', 'S/', 3.72, ARRAY['PE']),
('TZS', 'Tanzanian Shilling', 'TSh', 2520.0, ARRAY['TZ']),
('UGX', 'Ugandan Shilling', 'USh', 3750.0, ARRAY['UG']),
('RWF', 'Rwandan Franc', 'FRw', 1280.0, ARRAY['RW']),
('ETB', 'Ethiopian Birr', 'Br', 56.5, ARRAY['ET']),
('MAD', 'Moroccan Dirham', 'د.م.', 10.1, ARRAY['MA']),
('XOF', 'West African CFA', 'CFA', 605.0, ARRAY['SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ']),
('XAF', 'Central African CFA', 'FCFA', 605.0, ARRAY['CM', 'GA', 'CG', 'TD', 'CF', 'GQ']);

-- Add currency and location columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS detected_country_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Create trigger to update updated_at on currency_rates
CREATE TRIGGER update_currency_rates_updated_at
BEFORE UPDATE ON public.currency_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();