import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Coins, DollarSign, Check, X, MessageCircle, FileImage, Shield } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { P2PChat } from '@/components/p2p/P2PChat';
import { P2PDisputePanel } from '@/components/p2p/P2PDisputePanel';
import { P2PProofUploader } from '@/components/p2p/P2PProofUploader';
import { P2PTransactionTimeline } from '@/components/p2p/P2PTransactionTimeline';
import { format } from 'date-fns';
import { useState } from 'react';

const P2PTransaction = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice, convertFromUSD, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const { data: transaction, isLoading } = useQuery({
    queryKey: ['p2p-transaction', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId,
  });

  const { data: profiles } = useQuery({
    queryKey: ['p2p-profiles', transaction?.buyer_id, transaction?.seller_id],
    queryFn: async () => {
      const ids = [transaction?.buyer_id, transaction?.seller_id].filter(Boolean);
      const { data } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', ids);
      return new Map(data?.map(p => [p.id, p]) || []);
    },
    enabled: !!transaction,
  });

  const { data: dispute } = useQuery({
    queryKey: ['p2p-dispute', transactionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('p2p_disputes')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle();
      return data;
    },
    enabled: !!transactionId,
  });

  const { data: proofs } = useQuery({
    queryKey: ['p2p-proofs', transactionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('p2p_payment_proofs')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!transactionId,
  });

  const isBuyer = user?.id === transaction?.buyer_id;
  const isSeller = user?.id === transaction?.seller_id;
  const buyer = profiles?.get(transaction?.buyer_id);
  const seller = profiles?.get(transaction?.seller_id);

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('p2p-escrow', {
        body: { action: 'confirm_payment', transactionId },
      });
      if (error) throw error;
      toast.success('Payment confirmed! Credits transferred.');
      queryClient.invalidateQueries({ queryKey: ['p2p-transaction', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('p2p-escrow', {
        body: { action: 'cancel_transaction', transactionId },
      });
      if (error) throw error;
      toast.success('Transaction cancelled');
      navigate('/wallet/p2p');
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      proof_submitted: 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-muted',
      disputed: 'bg-destructive',
    };
    return colors[status] || 'bg-muted';
  };

  if (isLoading || !transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const localPrice = convertFromUSD(transaction.price_usd);
  const chatDisabled = ['completed', 'cancelled'].includes(transaction.status);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/wallet/p2p')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">Transaction</h1>
                <p className="text-xs text-muted-foreground">ID: {transactionId?.slice(0, 8)}...</p>
              </div>
            </div>
            <Badge className={getStatusColor(transaction.status)}>
              {transaction.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <Coins className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{transaction.credits_amount}</p>
                <p className="text-xs text-muted-foreground">Credits</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold">{currencySymbol}{localPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">~${transaction.price_usd} USD</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Seller</p>
                <p className="font-medium">@{seller?.username || 'Loading...'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Buyer</p>
                <p className="font-medium">@{buyer?.username || 'Loading...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1">
              <MessageCircle className="w-4 h-4" /> Chat
            </TabsTrigger>
            <TabsTrigger value="proofs" className="gap-1">
              <FileImage className="w-4 h-4" /> Proofs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <P2PTransactionTimeline transaction={transaction} isBuyer={isBuyer} />

            {/* Action Buttons */}
            {isBuyer && transaction.status === 'pending' && (
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleCancel} disabled={processing}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
              </div>
            )}

            {isSeller && transaction.status === 'proof_submitted' && (
              <div className="flex gap-2">
                <Button onClick={handleConfirmPayment} disabled={processing} className="flex-1">
                  <Check className="w-4 h-4 mr-2" /> Confirm & Release
                </Button>
                <P2PDisputePanel
                  transactionId={transactionId!}
                  buyerId={transaction.buyer_id}
                  sellerId={transaction.seller_id}
                  transactionStatus={transaction.status}
                />
              </div>
            )}

            {isSeller && transaction.status === 'pending' && (
              <Button variant="outline" onClick={handleCancel} disabled={processing}>
                Cancel Transaction
              </Button>
            )}

            {/* Dispute Panel */}
            {transaction.status === 'disputed' && (
              <P2PDisputePanel
                transactionId={transactionId!}
                buyerId={transaction.buyer_id}
                sellerId={transaction.seller_id}
                transactionStatus={transaction.status}
              />
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <div className="h-[400px]">
              <P2PChat
                transactionId={transactionId!}
                buyerId={transaction.buyer_id}
                sellerId={transaction.seller_id}
                moderatorId={dispute?.moderator_id}
                disabled={chatDisabled}
              />
            </div>
          </TabsContent>

          <TabsContent value="proofs" className="mt-4 space-y-4">
            {isBuyer && transaction.status === 'pending' && (
              <P2PProofUploader
                transactionId={transactionId!}
                proofType="payment"
                title="Upload Payment Proof"
                description="Upload a screenshot of your payment confirmation"
                onUploadSuccess={() => queryClient.invalidateQueries({ queryKey: ['p2p-transaction', transactionId] })}
              />
            )}

            {proofs && proofs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Uploaded Proofs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {proofs.map((proof: any) => (
                    <a
                      key={proof.id}
                      href={proof.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80"
                    >
                      <FileImage className="w-8 h-8 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium capitalize">{proof.proof_type} Proof</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(proof.created_at), 'PPp')}
                        </p>
                      </div>
                      {proof.verified && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="w-3 h-3" /> Verified
                        </Badge>
                      )}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default P2PTransaction;
