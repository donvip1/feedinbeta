import React, { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";

interface CreditTransaction {
  id: number;
  user_id: string;
  amount: number;
  type: 'refund' | 'admin_grant' | 'bonus';
  description: string;
  created_at: string;
}

export default function CreditNotifications() {
  // Safety check
  if (!React || typeof React.useState !== 'function') {
    return null;
  }

  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('credit-transactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'credit_transactions' },
        (payload: { new: CreditTransaction }) => {
          const tx = payload.new;
          if (tx.user_id !== user.id) return;
          if (tx.type === 'refund') {
            toast.success('Credits refunded', { description: `${tx.amount} credits returned` });
          }
          if (tx.type === 'admin_grant' || tx.type === 'bonus') {
            toast.success('Bonus credits received', { description: `${tx.amount} bonus credits added` });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
