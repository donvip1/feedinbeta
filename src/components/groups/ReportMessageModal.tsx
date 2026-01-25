import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag } from "lucide-react";

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  senderId: string;
  messageContent?: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'misinformation', label: 'False information' },
  { value: 'copyright', label: 'Copyright violation' },
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
      toast.error("Please select a reason");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase
        .from("content_reports")
        .insert({
          reporter_id: user.id,
          reported_user_id: senderId,
          content_type: 'message',
          content_id: messageId,
          reason: reason,
          description: description.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      toast.success("Report submitted successfully");
      handleClose();
    } catch (error: any) {
      console.error("Error submitting report:", error);
      toast.error(error.message || "Failed to submit report");
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
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            Report Message
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {messageContent && (
            <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground line-clamp-3">
              "{messageContent}"
            </div>
          )}

          <div>
            <Label>Why are you reporting this message?</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="mt-3">
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="cursor-pointer font-normal">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide more context about why you're reporting this..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !reason} 
              className="flex-1"
              variant="destructive"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
