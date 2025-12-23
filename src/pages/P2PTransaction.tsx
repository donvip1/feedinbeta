import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Check, X, Coins, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { format } from 'date-fns';

const P2PTransaction = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { data: transaction, refetch } = useQuery({
    queryKey: ['p2p-transaction', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_transactions')
        .select('*, p2p_listings(*)')
        .eq('id', transactionId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!transactionId,
  });

  const { data: buyer } = useQuery({
    queryKey: ['profile', transaction?.buyer_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('display_name, username')
        .eq('id', transaction?.buyer_id)
        .single();
      return data;
    },
    enabled: !!transaction?.buyer_id,
  });

  const { data: seller } = useQuery({
    queryKey: ['profile', transaction?.seller_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('display_name, username')
        .eq('id', transaction?.seller_id)
        .single();
      return data;
    },
    enabled: !!transaction?.seller_id,
  });

  const isBuyer = user?.id === transaction?.buyer_id;
  const isSeller = user?.id === transaction?.seller_id;

  const handleUploadProof = async () => {
    if (!proofFile || !transactionId) return;

    setUploading(true);
    try {
      // Upload file
      const fileExt = proofFile.name.split('.').pop();
      const filePath = `proofs/${transactionId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-documents')
        .upload(filePath, proofFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-documents')
        .getPublicUrl(filePath);

      // Update transaction with proof URL
      const { error } = await supabase.functions.invoke('p2p-escrow', {
        body: {
          action: 'upload_proof',
          transactionId,
          proofUrl: publicUrl,
        },
      });

      if (error) throw error;

      toast.success('Proof uploaded successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload proof');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('p2p-escrow', {
        body: {
          action: 'confirm_payment',
          transactionId,
        },
      });

      if (error) throw error;

      toast.success('Payment confirmed! Credits have been transferred.');
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelTransaction = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('p2p-escrow', {
        body: {
          action: 'cancel_transaction',
          transactionId,
        },
      });

      if (error) throw error;

      toast.success('Transaction cancelled. Credits refunded to seller.');
      navigate('/wallet/p2p');
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel transaction');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'proof_submitted': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/wallet/p2p')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Transaction Details</h1>
              <p className="text-sm text-muted-foreground">ID: {transactionId?.slice(0, 8)}...</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Transaction Status
              </CardTitle>
              <Badge className={getStatusColor(transaction.status)}>
                {transaction.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Credits</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <Coins className="w-5 h-5" />
                  {transaction.credits_amount}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <DollarSign className="w-5 h-5" />
                  {transaction.price_usd}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Seller</p>
                <p className="font-medium">@{seller?.username || 'Loading...'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Buyer</p>
                <p className="font-medium">@{buyer?.username || 'Loading...'}</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Created: {format(new Date(transaction.created_at), 'PPp')}
            </div>
          </CardContent>
        </Card>

        {/* Buyer Actions */}
        {isBuyer && transaction.status === 'pending' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Payment Proof</CardTitle>
              <CardDescription>
                Please make payment to the seller and upload proof (screenshot, receipt, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-500">Payment Instructions</p>
                    <p className="text-sm text-muted-foreground">
                      Contact the seller to arrange payment. Once paid, upload proof below.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <Label>Proof of Payment</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleUploadProof} 
                  disabled={!proofFile || uploading}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Proof'}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleCancelTransaction}
                  disabled={processing}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proof Submitted - Waiting for seller */}
        {isBuyer && transaction.status === 'proof_submitted' && (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-semibold">Waiting for Seller Confirmation</h3>
              <p className="text-muted-foreground">
                Your payment proof has been submitted. Waiting for the seller to confirm.
              </p>
              {transaction.proof_url && (
                <a 
                  href={transaction.proof_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-4 inline-block"
                >
                  View Submitted Proof
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seller Actions */}
        {isSeller && transaction.status === 'proof_submitted' && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Payment Receipt</CardTitle>
              <CardDescription>
                Review the payment proof and confirm if you received the payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {transaction.proof_url && (
                <div>
                  <Label>Payment Proof</Label>
                  <a 
                    href={transaction.proof_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-4 border rounded-lg hover:bg-muted transition-colors"
                  >
                    View Payment Proof →
                  </a>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  onClick={handleConfirmPayment}
                  disabled={processing}
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {processing ? 'Processing...' : 'Confirm & Release Credits'}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleCancelTransaction}
                  disabled={processing}
                >
                  <X className="w-4 h-4 mr-2" />
                  Dispute
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isSeller && transaction.status === 'pending' && (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-semibold">Waiting for Buyer</h3>
              <p className="text-muted-foreground">
                The buyer needs to make payment and upload proof.
              </p>
              <Button 
                variant="destructive" 
                onClick={handleCancelTransaction}
                disabled={processing}
                className="mt-4"
              >
                Cancel Transaction
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Completed */}
        {transaction.status === 'completed' && (
          <Card>
            <CardContent className="py-8 text-center">
              <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold text-green-500">Transaction Complete!</h3>
              <p className="text-muted-foreground">
                {isBuyer 
                  ? `You received ${transaction.credits_amount} credits.`
                  : `You sold ${transaction.credits_amount} credits for $${transaction.price_usd}.`
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cancelled */}
        {transaction.status === 'cancelled' && (
          <Card>
            <CardContent className="py-8 text-center">
              <X className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold text-red-500">Transaction Cancelled</h3>
              <p className="text-muted-foreground">
                This transaction has been cancelled. Credits have been refunded to the seller.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default P2PTransaction;