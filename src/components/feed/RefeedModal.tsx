import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Repeat, Quote } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RefeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export default function RefeedModal({ isOpen, onClose, postId }: RefeedModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleRefeed = async () => {
    if (!user) return;

    try {
      await supabase.from('post_shares').insert({
        post_id: postId,
        user_id: user.id,
        share_type: 'refeed',
      });

      toast({ title: 'Refeeded successfully!' });
      onClose();
    } catch (error) {
      toast({
        title: 'Error refeeding post',
        variant: 'destructive',
      });
    }
  };

  const handleQuoteRefeed = () => {
    // Navigate to quote composer
    console.log('Quote refeed:', postId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={handleRefeed}
          >
            <Repeat className="w-5 h-5" />
            <span>Refeed</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={handleQuoteRefeed}
          >
            <Quote className="w-5 h-5" />
            <span>Quote Refeed</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
