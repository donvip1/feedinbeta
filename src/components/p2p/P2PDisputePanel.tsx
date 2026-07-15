import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, Shield, Upload, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface P2PDisputePanelProps {
  transactionId: string;
  buyerId: string;
  sellerId: string;
  transactionStatus: string;
  onDisputeCreated?: () => void;
}

const DISPUTE_REASONS = [
  { value: 'no_payment', label: 'Did not receive payment' },
  { value: 'wrong_amount', label: 'Wrong payment amount' },
  { value: 'no_credits', label: 'Did not receive credits' },
  { value: 'fraud', label: 'Suspected fraud' },
  { value: 'unresponsive', label: 'Other party unresponsive' },
  { value: 'other', label: 'Other issue' },
];

export const P2PDisputePanel = ({
  transactionId,
  buyerId,
  sellerId,
  transactionStatus,
  onDisputeCreated,
}: P2PDisputePanelProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const isBuyer = user?.id === buyerId;
  const isSeller = user?.id === sellerId;

  // Fetch existing dispute
  const { data: dispute, isLoading } = useQuery({
    queryKey: ['p2p-dispute', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_disputes')
        .select('*, moderator:profiles!p2p_disputes_moderator_id_fkey(display_name, username, avatar_url)')
        .eq('transaction_id', transactionId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Create dispute mutation
  const createDisputeMutation = useMutation({
    mutationFn: async () => {
      // First upload evidence if provided
      let evidenceUrl: string | undefined;
      if (evidenceFile) {
        const fileExt = evidenceFile.name.split('.').pop();
        const filePath = `disputes/${transactionId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('p2p-proofs')
          .upload(filePath, evidenceFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('p2p-proofs')
          .getPublicUrl(filePath);

        evidenceUrl = publicUrl;
      }

      const details = [
        reason,
        description.trim(),
        evidenceUrl ? `Evidence: ${evidenceUrl}` : '',
      ].filter(Boolean).join(' | ');
      const { error } = await (supabase as any).rpc(
        'p2p_open_dispute',
        {
          p_transaction_id: transactionId,
          p_reason: details,
        },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dispute created. A moderator will be assigned shortly.');
      setIsCreateOpen(false);
      setReason('');
      setDescription('');
      setEvidenceFile(null);
      queryClient.invalidateQueries({ queryKey: ['p2p-dispute', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['p2p-transaction', transactionId] });
      onDisputeCreated?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create dispute');
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'under_review':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getResolutionLabel = (resolution: string) => {
    switch (resolution) {
      case 'buyer_wins':
        return 'Resolved in favor of buyer';
      case 'seller_wins':
        return 'Resolved in favor of seller';
      case 'split':
        return 'Split resolution';
      case 'cancelled':
        return 'Dispute cancelled';
      default:
        return resolution;
    }
  };

  const canCreateDispute = 
    (isBuyer || isSeller) && 
    !dispute && 
    !['completed', 'cancelled'].includes(transactionStatus);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  // Show existing dispute
  if (dispute) {
    return (
      <Card className="border-destructive/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Dispute Active
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              {getStatusIcon(dispute.status)}
              {dispute.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          <CardDescription>
            Opened {format(new Date(dispute.created_at), 'PPp')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Reason</Label>
            <p className="font-medium">
              {DISPUTE_REASONS.find(r => r.value === dispute.reason)?.label || dispute.reason}
            </p>
          </div>

          {dispute.moderator_id && (
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Moderator Assigned</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                A moderator is reviewing this dispute and the transaction history.
              </p>
            </div>
          )}

          {/* Resolution */}
          {dispute.resolution && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{getResolutionLabel(dispute.resolution)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show create dispute button
  if (!canCreateDispute) return null;

  return (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <AlertTriangle className="w-4 h-4" />
          Open Dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a Dispute</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm">
              Opening a dispute will pause the transaction and assign a moderator to review. 
              This should only be used if you have a genuine issue that cannot be resolved directly.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Reason for Dispute</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Evidence (optional)</Label>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              id="initial-evidence"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById('initial-evidence')?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {evidenceFile ? evidenceFile.name : 'Upload Screenshot/Proof'}
            </Button>
          </div>

          <Button
            className="w-full"
            onClick={() => createDisputeMutation.mutate()}
            disabled={!reason || createDisputeMutation.isPending}
          >
            {createDisputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
