import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Loader2 } from 'lucide-react';

interface Bank {
  name: string;
  code: string;
}

interface BankAccountFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

export const BankAccountForm: React.FC<BankAccountFormProps> = ({ onSaved, onCancel }) => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-withdrawal', {
        body: { action: 'list-banks' },
      });
      if (error) throw error;
      setBanks(data?.data || []);
    } catch (err: any) {
      toast.error('Failed to load banks');
    } finally {
      setLoadingBanks(false);
    }
  };

  const verifyAccount = async () => {
    if (!selectedBankCode || accountNumber.length < 10) {
      toast.error('Please select a bank and enter a valid account number');
      return;
    }
    setVerifying(true);
    setVerifiedName('');
    try {
      const { data, error } = await supabase.functions.invoke('paystack-withdrawal', {
        body: { action: 'verify-account', account_number: accountNumber, bank_code: selectedBankCode },
      });
      if (error) throw error;
      if (data?.status && data?.data?.account_name) {
        setVerifiedName(data.data.account_name);
        toast.success(`Account verified: ${data.data.account_name}`);
      } else {
        toast.error(data?.message || 'Could not verify account');
      }
    } catch (err: any) {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const saveAccount = async () => {
    if (!verifiedName) return;
    setSaving(true);
    try {
      const bankName = banks.find(b => b.code === selectedBankCode)?.name || '';
      const { data, error } = await supabase.functions.invoke('paystack-withdrawal', {
        body: {
          action: 'save-bank-account',
          bank_code: selectedBankCode,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: verifiedName,
        },
      });
      if (error) throw error;
      toast.success('Bank account saved');
      onSaved();
    } catch (err: any) {
      toast.error('Failed to save bank account');
    } finally {
      setSaving(false);
    }
  };

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>Bank</Label>
        {loadingBanks ? (
          <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading banks...
          </div>
        ) : (
          <>
            <Input
              placeholder="Search bank..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="mt-1.5"
            />
            {bankSearch && filteredBanks.length > 0 && !selectedBankCode && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-border rounded-md bg-card">
                {filteredBanks.slice(0, 20).map((bank) => (
                  <button
                    key={bank.code}
                    onClick={() => {
                      setSelectedBankCode(bank.code);
                      setBankSearch(bank.name);
                      setVerifiedName('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors"
                  >
                    {bank.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <Label>Account Number</Label>
        <Input
          placeholder="0123456789"
          value={accountNumber}
          onChange={(e) => {
            setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
            setVerifiedName('');
          }}
          maxLength={10}
          className="mt-1.5"
        />
      </div>

      {verifiedName && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">{verifiedName}</span>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        {!verifiedName ? (
          <Button
            onClick={verifyAccount}
            disabled={verifying || !selectedBankCode || accountNumber.length < 10}
            className="flex-1"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Verify
          </Button>
        ) : (
          <Button onClick={saveAccount} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Account
          </Button>
        )}
      </div>
    </div>
  );
};
