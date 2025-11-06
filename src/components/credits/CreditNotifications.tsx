import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";

export default function CreditNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('credit-transactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'credit_transactions' },
        (payload: any) => {
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
