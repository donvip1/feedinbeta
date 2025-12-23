import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Heart } from 'lucide-react';

interface GiftAppreciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  giftId: string;
  isReceiver: boolean; // true = receiver sending appreciation, false = sender viewing receiver's feedback
  existingFeedback?: string;
}

export const GiftAppreciationModal: React.FC<GiftAppreciationModalProps> = ({
  isOpen,
  onClose,
  giftId,
  isReceiver,
  existingFeedback,
}) => {
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Fetch appreciation options
  const { data: options, isLoading: loadingOptions } = useQuery({
    queryKey: ['appreciation-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_appreciation_options')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Submit appreciation
  const submitAppreciation = useMutation({
    mutationFn: async (feedback: string) => {
      const updateField = isReceiver ? 'receiver_feedback' : 'sender_feedback';
      
      const { error } = await supabase
        .from('gift_analytics')
        .update({
          [updateField]: feedback,
          feedback_timestamp: new Date().toISOString(),
        })
        .eq('id', giftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['sent-gifts'] });
      toast.success('Appreciation sent!');
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to send appreciation', {
        description: error.message,
      });
    },
  });

  const handleSubmit = () => {
    if (selectedOption) {
      submitAppreciation.mutate(selectedOption);
    }
  };

  if (existingFeedback) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              {isReceiver ? 'Your appreciation' : 'Appreciation received'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-accent/50 rounded-lg text-center">
            <p className="text-lg">{existingFeedback}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Send appreciation
          </DialogTitle>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Choose a message to show your appreciation
            </p>

            <div className="grid grid-cols-2 gap-2">
              {options?.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedOption === `${option.emoji} ${option.message}` ? 'default' : 'outline'}
                  className="h-auto py-3 px-4 justify-start text-left"
                  onClick={() => setSelectedOption(`${option.emoji} ${option.message}`)}
                >
                  <span className="text-xl mr-2">{option.emoji}</span>
                  <span className="text-sm">{option.message}</span>
                </Button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedOption || submitAppreciation.isPending}
                className="flex-1"
              >
                {submitAppreciation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
