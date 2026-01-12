import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { P2P_CONFIG, getCountryByCode } from '@/lib/p2p-config';
import { Building2, CreditCard, User, Globe } from 'lucide-react';

interface BankDetailsFormProps {
  countryCode: string;
  onSubmit: (details: BankDetails) => void;
  isLoading?: boolean;
  initialData?: Partial<BankDetails>;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
  swift_code?: string;
  iban?: string;
  routing_number?: string;
  additional_info?: string;
}

export const BankDetailsForm: React.FC<BankDetailsFormProps> = ({
  countryCode,
  onSubmit,
  isLoading = false,
  initialData = {},
}) => {
  const [bankName, setBankName] = useState(initialData.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(initialData.account_number || '');
  const [accountName, setAccountName] = useState(initialData.account_name || '');
  const [swiftCode, setSwiftCode] = useState(initialData.swift_code || '');
  const [iban, setIban] = useState(initialData.iban || '');
  const [routingNumber, setRoutingNumber] = useState(initialData.routing_number || '');
  const [additionalInfo, setAdditionalInfo] = useState(initialData.additional_info || '');

  const isNigeria = countryCode === 'NG';
  const countryInfo = getCountryByCode(countryCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const details: BankDetails = {
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
    };

    if (!isNigeria) {
      details.swift_code = swiftCode;
      details.iban = iban;
      if (countryCode === 'US') {
        details.routing_number = routingNumber;
      }
    }

    if (additionalInfo) {
      details.additional_info = additionalInfo;
    }

    onSubmit(details);
  };

  const isFormValid = () => {
    if (!bankName || !accountNumber || !accountName) return false;
    if (!isNigeria && !swiftCode) return false;
    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
        <Globe className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {countryInfo?.name || countryCode} ({countryInfo?.currency || 'USD'})
        </span>
      </div>

      {/* Bank Name */}
      <div className="space-y-2">
        <Label htmlFor="bank_name" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Bank Name
        </Label>
        {isNigeria ? (
          <Select value={bankName} onValueChange={setBankName}>
            <SelectTrigger>
              <SelectValue placeholder="Select your bank" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {P2P_CONFIG.NIGERIAN_BANKS.map((bank) => (
                <SelectItem key={bank} value={bank}>
                  {bank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="bank_name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Enter your bank name"
            required
          />
        )}
      </div>

      {/* Account Number */}
      <div className="space-y-2">
        <Label htmlFor="account_number" className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {isNigeria ? 'Account Number (NUBAN)' : 'Account Number'}
        </Label>
        <Input
          id="account_number"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          placeholder={isNigeria ? '10-digit account number' : 'Account number'}
          maxLength={isNigeria ? 10 : 34}
          required
        />
        {isNigeria && accountNumber.length > 0 && accountNumber.length !== 10 && (
          <p className="text-xs text-destructive">Nigerian account numbers must be 10 digits</p>
        )}
      </div>

      {/* Account Name */}
      <div className="space-y-2">
        <Label htmlFor="account_name" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Account Holder Name
        </Label>
        <Input
          id="account_name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Full name as shown on account"
          required
        />
      </div>

      {/* International fields */}
      {!isNigeria && (
        <>
          <div className="space-y-2">
            <Label htmlFor="swift_code">SWIFT/BIC Code</Label>
            <Input
              id="swift_code"
              value={swiftCode}
              onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
              placeholder="e.g., BNPAFRPP"
              maxLength={11}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN (Optional)</Label>
            <Input
              id="iban"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="e.g., GB82 WEST 1234 5698 7654 32"
              maxLength={34}
            />
          </div>

          {countryCode === 'US' && (
            <div className="space-y-2">
              <Label htmlFor="routing_number">Routing Number (ABA)</Label>
              <Input
                id="routing_number"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="9-digit routing number"
                maxLength={9}
              />
            </div>
          )}
        </>
      )}

      {/* Additional Info */}
      <div className="space-y-2">
        <Label htmlFor="additional_info">Additional Instructions (Optional)</Label>
        <Input
          id="additional_info"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          placeholder="Any special instructions for payment"
        />
      </div>

      {/* Preview Card */}
      {bankName && accountNumber && accountName && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment Details Preview</CardTitle>
            <CardDescription className="text-xs">This is how your details will appear to buyers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Bank:</span> {bankName}</p>
            <p><span className="text-muted-foreground">Account:</span> {accountNumber}</p>
            <p><span className="text-muted-foreground">Name:</span> {accountName}</p>
            {swiftCode && <p><span className="text-muted-foreground">SWIFT:</span> {swiftCode}</p>}
          </CardContent>
        </Card>
      )}

      <Button 
        type="submit" 
        className="w-full" 
        disabled={!isFormValid() || isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Payment Method'}
      </Button>
    </form>
  );
};
