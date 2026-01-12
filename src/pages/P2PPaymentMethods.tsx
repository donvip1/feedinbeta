import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { toast } from 'sonner';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BankDetailsForm, BankDetails } from '@/components/p2p/BankDetailsForm';
import { PaymentMethodCard } from '@/components/p2p/PaymentMethodCard';
import { P2P_CONFIG, getCountryByCode } from '@/lib/p2p-config';
import { Plus, CreditCard, AlertCircle, Globe, Wallet, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const P2PPaymentMethods = () => {
  const { user } = useAuth();
  const { userLocation } = useCurrency();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const locationCode = typeof userLocation === 'string' ? userLocation : userLocation?.countryCode || 'NG';
  const [selectedCountry, setSelectedCountry] = useState(locationCode);
  const [editingMethod, setEditingMethod] = useState<string | null>(null);

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['p2p-payment-methods', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_payment_methods')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Add payment method mutation
  const addMethodMutation = useMutation({
    mutationFn: async (details: BankDetails & { countryCode: string; currencyCode: string }) => {
      const countryInfo = getCountryByCode(details.countryCode);
      
      const { error } = await supabase
        .from('p2p_payment_methods')
        .insert([{
          user_id: user?.id,
          method_type: 'bank_transfer',
          method_name: details.bank_name,
          account_details: details as unknown as { [key: string]: string },
          country_code: details.countryCode,
          currency_code: details.currencyCode || countryInfo?.currency || 'USD',
          is_default: (paymentMethods?.length ?? 0) === 0,
          is_active: true,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment method added successfully');
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['p2p-payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['p2p-eligibility'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add payment method');
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (methodId: string) => {
      // First, unset all defaults
      await supabase
        .from('p2p_payment_methods')
        .update({ is_default: false })
        .eq('user_id', user?.id);
      
      // Set new default
      const { error } = await supabase
        .from('p2p_payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Default payment method updated');
      queryClient.invalidateQueries({ queryKey: ['p2p-payment-methods'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (methodId: string) => {
      const { error } = await supabase
        .from('p2p_payment_methods')
        .update({ is_active: false })
        .eq('id', methodId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment method removed');
      queryClient.invalidateQueries({ queryKey: ['p2p-payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['p2p-eligibility'] });
    },
  });

  const handleAddMethod = (details: BankDetails) => {
    const countryInfo = getCountryByCode(selectedCountry);
    addMethodMutation.mutate({
      ...details,
      countryCode: selectedCountry,
      currencyCode: countryInfo?.currency || 'USD',
    });
  };

  return (
    <PageWrapper>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Payment Methods</h1>
                <p className="text-sm text-muted-foreground">Manage your P2P payment details</p>
              </div>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Add Payment Method
                  </DialogTitle>
                  <DialogDescription>
                    Add your bank details to receive payments from P2P trades
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Country Selection */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Select Country
                    </Label>
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {P2P_CONFIG.SUPPORTED_COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name} ({country.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <BankDetailsForm
                    countryCode={selectedCountry}
                    onSubmit={handleAddMethod}
                    isLoading={addMethodMutation.isPending}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Wallet className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Why add payment methods?</p>
                <p className="text-xs text-muted-foreground">
                  To sell credits on the P2P marketplace, you need to add at least one bank account. 
                  Buyers will send payment to this account when they purchase your credits.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Region Lock Notice */}
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm text-yellow-600">Region-Locked Trading</p>
                <p className="text-xs text-muted-foreground">
                  P2P trades are currently limited to users in the same country. 
                  You can only trade with users who share your location.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-yellow-500/10">
                    PayPal International
                  </Badge>
                  <span className="text-xs text-muted-foreground">Coming Soon</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Your Payment Methods</h3>
            <Badge variant="secondary">
              {paymentMethods?.length || 0} methods
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-muted rounded-lg" />
              ))}
            </div>
          ) : paymentMethods?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2">No payment methods yet</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Add a payment method to start selling credits on the P2P marketplace
                </p>
                <Button onClick={() => setIsAddModalOpen(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paymentMethods?.map((method) => {
                const details = method.account_details as unknown as BankDetails;
                return (
                  <PaymentMethodCard
                    key={method.id}
                    id={method.id}
                    bankName={details?.bank_name || method.method_name || 'Unknown Bank'}
                    accountNumber={details?.account_number || '****'}
                    accountName={details?.account_name || 'Unknown'}
                    countryCode={method.country_code || 'US'}
                    currencyCode={method.currency_code || 'USD'}
                    isDefault={method.is_default || false}
                    isVerified={method.is_verified || false}
                    onSetDefault={() => setDefaultMutation.mutate(method.id)}
                    onEdit={() => setEditingMethod(method.id)}
                    onDelete={() => deleteMutation.mutate(method.id)}
                    isLoading={setDefaultMutation.isPending || deleteMutation.isPending}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* P2P Rate Info */}
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              P2P Trading Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buy Rate (Store)</span>
              <span className="font-medium">100 credits = $1 USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sell Rate (P2P)</span>
              <span className="font-medium text-primary">85 credits = $1 USD</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              When selling on P2P, you get slightly less than store value. This difference incentivizes buyers to use P2P.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default P2PPaymentMethods;
