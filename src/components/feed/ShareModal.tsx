import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Share2, Bookmark, Link2, Download } from 'lucide-react';
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

  const handleSharePost = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out this post',
        url: `${window.location.origin}/post/${postId}`
      });
    } else {
      toast({ title: 'Sharing not supported on this device' });
    }
  };

  const handleSavePost = async () => {
    toast({ 
      title: 'Post saved!',
      description: 'Added to your saved posts'
    });
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    toast({ 
      title: 'Link copied!',
      description: 'Post link copied to clipboard'
    });
    setTimeout(() => onClose(), 1000);
  };

  const handleDownload = () => {
    toast({ 
      title: 'Download started',
      description: 'Media is being downloaded'
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl p-0 pb-6">
        <div className="space-y-1 p-4">
          <Button
            onClick={handleSharePost}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Share2 className="w-5 h-5" />
            <span className="font-medium">Share Post</span>
          </Button>

          <Button
            onClick={handleSavePost}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Bookmark className="w-5 h-5" />
            <span className="font-medium">Save Post</span>
          </Button>

          <Button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Link2 className="w-5 h-5" />
            <span className="font-medium">Copy Link</span>
          </Button>

          <Button
            onClick={handleDownload}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary"
            variant="ghost"
          >
            <Download className="w-5 h-5" />
            <span className="font-medium">Download</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
