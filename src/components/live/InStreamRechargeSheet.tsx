import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePaystack } from '@/hooks/usePaystack';
import { cn } from '@/lib/utils';

interface InStreamRechargeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onBalanceUpdate?: (newBalance: number) => void;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus_credits: number;
  price: number;
  is_popular?: boolean;
}

export const InStreamRechargeSheet: React.FC<InStreamRechargeSheetProps> = ({
  isOpen,
  onClose,
  currentBalance,
  onBalanceUpdate,
}) => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [currencyCode, setCurrencyCode] = useState('USD');

  const { loading, initializePayment } = usePaystack({
    type: 'credits',
    onSuccess: () => {
      onClose();
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoadingPackages(true);
      const [{ data: pkgs }, { data: rates }] = await Promise.all([
        supabase
          .from('credit_packages')
          .select('*')
          .eq('is_active', true)
          .gte('credits', 50)
          .order('price', { ascending: true }),
        supabase
          .from('exchange_rates')
          .select('*')
          .eq('is_active', true)
          .single(),
      ]);

      if (pkgs) {
        setPackages(pkgs as CreditPackage[]);
        if (pkgs.length > 0) {
          const popular = pkgs.find((p: any) => p.is_popular);
          setSelectedId(popular?.id || pkgs[0].id);
        }
      }

      if (rates) {
        setExchangeRate((rates as any).rate || 1);
        setCurrencySymbol((rates as any).symbol || '$');
        setCurrencyCode((rates as any).currency_code || 'USD');
      }
      setLoadingPackages(false);
    };
    fetchData();
  }, [isOpen]);

  const handleRecharge = async () => {
    if (!selectedId) return;
    await initializePayment(selectedId);
  };

  const formatLocalPrice = (price: number) => {
    const local = price * exchangeRate;
    return `${currencySymbol}${local.toLocaleString(undefined, { maximumFractionDigits: exchangeRate > 100 ? 0 : 2 })}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-zinc-900 rounded-t-3xl max-h-[75vh] flex flex-col"
            style={{ touchAction: 'manipulation' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="text-white font-black text-lg">Recharge</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Balance */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm">Balance:</span>
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-white font-bold">{currentBalance.toLocaleString()}</span>
                {currentBalance < 50 && (
                  <span className="text-rose-400 text-xs font-medium ml-1">Low balance</span>
                )}
              </div>
            </div>

            {/* Packages Grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-4" data-scrollable="true">
              {loadingPackages ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {packages.map((pkg) => {
                    const total = pkg.credits + (pkg.bonus_credits || 0);
                    const isSelected = selectedId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedId(pkg.id)}
                        className={cn(
                          "relative flex flex-col items-center justify-center py-3.5 px-2 rounded-xl border-2 transition-all active:scale-95",
                          isSelected
                            ? "border-rose-500 bg-rose-500/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        )}
                      >
                        {pkg.is_popular && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <span className="text-[8px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">HOT</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-white font-black text-lg">{total}</span>
                        </div>
                        <span className="text-white/40 text-[11px] font-medium mt-0.5">
                          {formatLocalPrice(pkg.price)}
                        </span>
                        {isSelected && (
                          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recharge Button */}
            <div className="px-5 pb-safe pt-2 pb-5 border-t border-white/5">
              <button
                onClick={handleRecharge}
                disabled={!selectedId || !!loading}
                className={cn(
                  "w-full py-3.5 rounded-full font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-all",
                  !selectedId || loading
                    ? "bg-white/10 text-white/30"
                    : "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Recharge'
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
