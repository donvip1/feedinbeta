import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface ProfileImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

export const ProfileImageModal = ({ isOpen, onClose, imageUrl, title }: ProfileImageModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-none">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        <div className="relative w-full h-[80vh]">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
