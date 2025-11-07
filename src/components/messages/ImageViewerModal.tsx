import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
}

export const ImageViewerModal = ({ open, onOpenChange, imageUrl }: ImageViewerModalProps) => {
  const { toast } = useToast();

  const downloadImage = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: 'Image downloaded' });
    } catch (error) {
      toast({ title: 'Failed to download image', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 bg-black/95 border-0">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70"
          >
            <X className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={downloadImage}
            className="absolute top-4 right-16 z-10 bg-black/50 text-white hover:bg-black/70"
          >
            <Download className="w-5 h-5" />
          </Button>
          <img 
            src={imageUrl} 
            alt="Full size" 
            className="w-full h-auto max-h-[90vh] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
