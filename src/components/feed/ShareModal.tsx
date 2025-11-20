import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Share2, MessageCircle, Users, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export default function ShareModal({ isOpen, onClose, postId }: ShareModalProps) {
  const shareOptions = [
    { icon: Instagram, label: 'Share to Story', action: () => console.log('Share to story') },
    { icon: MessageCircle, label: 'Send as Message', action: () => console.log('Send as message') },
    { icon: Users, label: 'Share to Group', action: () => console.log('Share to group') },
    { icon: Share2, label: 'Copy Link', action: () => {
      navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
      onClose();
    }},
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <h2 className="text-lg font-semibold mb-4">Share Post</h2>
        <div className="grid grid-cols-2 gap-3">
          {shareOptions.map((option) => (
            <Button
              key={option.label}
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4"
              onClick={option.action}
            >
              <option.icon className="w-6 h-6" />
              <span className="text-xs">{option.label}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
