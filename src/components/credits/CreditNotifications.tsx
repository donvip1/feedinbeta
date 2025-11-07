import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreditTransaction {
  id: number;
  user_id: string;
  amount: number;
  type: 'refund' | 'admin_grant' | 'bonus';
  description: string;
  created_at: string;
}

export default class CreditNotifications extends React.Component {
  private channel: any | null = null;
  private userId: string | null = null;
  private authUnsubscribe: (() => void) | null = null;

  async componentDidMount() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      this.userId = session?.user?.id ?? null;

      this.channel = supabase
        .channel('credit-transactions')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'credit_transactions' },
          (payload: { new: CreditTransaction }) => {
            const tx = payload.new;
            if (!this.userId || tx.user_id !== this.userId) return;
            if (tx.type === 'refund') {
              toast.success('Credits refunded', { description: `${tx.amount} credits returned` });
            }
            if (tx.type === 'admin_grant' || tx.type === 'bonus') {
              toast.success('Bonus credits received', { description: `${tx.amount} bonus credits added` });
            }
          }
        )
        .subscribe();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
        this.userId = sess?.user?.id ?? null;
      });
      this.authUnsubscribe = () => subscription.unsubscribe();
    } catch (error: any) {
      console.warn('CreditNotifications init error (suppressed):', error?.message || error);
    }
  }

  componentWillUnmount(): void {
    try {
      if (this.channel) supabase.removeChannel(this.channel);
      if (this.authUnsubscribe) this.authUnsubscribe();
    } catch {}
  }

  render() {
    return null;
  }
}
