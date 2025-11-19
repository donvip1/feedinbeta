import { useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MediaGalleryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: File[]) => void;
}

export function MediaGalleryPicker({ open, onClose, onSelect }: MediaGalleryPickerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      onClose();
      return;
    }

    const file = files[0]; // Only single selection

    // Validation
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 100MB',
        variant: 'destructive',
      });
      onClose();
      return;
    }

    // Automatically proceed with selected file
    onSelect([file]);
  };

  // Automatically trigger file selector on mount
  useEffect(() => {
    if (open) {
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  }, [open]);

  return (
    <>
      {/* Hidden File Input - opened automatically */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
}
