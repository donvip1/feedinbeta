import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FileUp } from "lucide-react";

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  moderationEventId: string;
  contentId: string;
  contentType: string;
}

export const AppealModal = ({
  isOpen,
  onClose,
  moderationEventId,
  contentId,
  contentType
}: AppealModalProps) => {
  const [appealText, setAppealText] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!appealText.trim()) {
      toast.error("Please provide details for your appeal");
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
        .from("moderation_appeals")
        .insert({
          user_id: user.id,
          moderation_event_id: moderationEventId,
          content_id: contentId,
          content_type: contentType,
          appeal_text: appealText,
          attachments: attachments,
          status: 'pending'
        });

      if (error) throw error;

      toast.success("Appeal submitted successfully. We'll review it within 48 hours.");
      onClose();
      
      setAppealText('');
      setAttachments([]);
    } catch (error: any) {
      console.error("Error submitting appeal:", error);
      toast.error(error.message || "Failed to submit appeal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Appeal Content Removal</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">What to include in your appeal:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Why you believe the removal was incorrect</li>
              <li>Context that may have been misunderstood</li>
              <li>Any relevant information to support your case</li>
            </ul>
          </div>

          <div>
            <Label htmlFor="appeal">Your Appeal</Label>
            <Textarea
              id="appeal"
              placeholder="Explain why you believe this content should be restored..."
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              rows={6}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {appealText.length}/1000 characters
            </p>
          </div>

          <div className="bg-primary/10 p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Review Timeline</p>
            <p className="text-muted-foreground">
              Appeals are typically reviewed within 48 hours. You'll receive a notification with the decision.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !appealText.trim()} 
              className="flex-1"
            >
              {loading ? "Submitting..." : "Submit Appeal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};