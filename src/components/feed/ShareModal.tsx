import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Share2, MessageCircle, Users, Instagram, Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export default function ShareModal({ isOpen, onClose, postId }: ShareModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    setCopied(true);
    toast({ 
      title: 'Link copied!',
      description: 'Post link copied to clipboard'
    });
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1500);
  };

  const shareOptions = [
    { 
      icon: Instagram, 
      label: 'Share to Story', 
      description: 'Post to your story',
      color: 'from-purple-500 to-pink-500',
      action: () => console.log('Share to story') 
    },
    { 
      icon: MessageCircle, 
      label: 'Send Message', 
      description: 'Share via DM',
      color: 'from-blue-500 to-cyan-500',
      action: () => console.log('Send as message') 
    },
    { 
      icon: Users, 
      label: 'Share to Group', 
      description: 'Post in a group',
      color: 'from-green-500 to-emerald-500',
      action: () => console.log('Share to group') 
    },
    { 
      icon: copied ? Check : Link2, 
      label: copied ? 'Copied!' : 'Copy Link', 
      description: 'Share anywhere',
      color: 'from-orange-500 to-red-500',
      action: handleCopyLink 
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl">
        <div className="py-4">
          <h2 className="text-xl font-bold mb-6 text-center">Share Post</h2>
          <div className="grid grid-cols-2 gap-4">
            {shareOptions.map((option) => (
              <Button
                key={option.label}
                variant="outline"
                className="flex flex-col items-center gap-3 h-auto py-6 rounded-2xl border-2 hover:border-primary hover:bg-accent/50 transition-all group"
                onClick={option.action}
              >
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${option.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <option.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
