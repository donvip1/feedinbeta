import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Flag, AlertTriangle } from 'lucide-react';

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  senderId: string;
  messageContent?: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'misinformation', label: 'False information' },
  { value: 'other', label: 'Other' },
];

export const ReportMessageModal = ({
  isOpen,
  onClose,
  messageId,
  senderId,
  messageContent,
}: ReportMessageModalProps) => {
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('content_reports')
        .insert({
          content_id: messageId,
          content_type: 'message',
          reporter_id: user.id,
          reported_user_id: senderId,
          reason,
          description: description.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Report submitted successfully', {
        description: 'Our team will review this message and take appropriate action.',
      });
      handleClose();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            Report Message
          </DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with this message
          </DialogDescription>
        </DialogHeader>

        {messageContent && (
          <div className="p-3 bg-muted rounded-lg text-sm line-clamp-3">
            <p className="text-muted-foreground text-xs mb-1">Message content:</p>
            {messageContent}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Why are you reporting this message?
            </Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REPORT_REASONS.map((item) => (
                <div key={item.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={item.value} id={item.value} />
                  <Label htmlFor={item.value} className="text-sm cursor-pointer">
                    {item.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context..."
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              False reports may result in action being taken against your account. 
              Only report content that genuinely violates our guidelines.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading || !reason} variant="destructive">
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
