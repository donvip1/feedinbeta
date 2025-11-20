import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CameraCaptureProps {
  onCapture: (media: { url: string; type: 'image' | 'video'; file: File }) => void;
  onClose: () => void;
  onStorySelect?: () => void;
}

export default function CameraCapture({ onCapture, onClose, onStorySelect }: CameraCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image or video file.',
        variant: 'destructive',
      });
      return;
    }

    const url = URL.createObjectURL(file);
    onCapture({
      url,
      type: isVideo ? 'video' : 'image',
      file,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="text-white text-xl font-semibold mb-8">Create Post</div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="bg-white text-black px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3 hover:bg-white/90 transition-colors"
        >
          <Camera className="w-6 h-6" />
          Camera
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-white/20 text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3 hover:bg-white/30 transition-colors backdrop-blur-sm"
        >
          <ImageIcon className="w-6 h-6" />
          Gallery
        </button>

        {onStorySelect && (
          <button
            onClick={onStorySelect}
            className="bg-primary/20 text-primary px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3 hover:bg-primary/30 transition-colors backdrop-blur-sm border border-primary/30"
          >
            <span className="text-2xl">📖</span>
            Story
          </button>
        )}
      </div>

      {/* Camera input with capture attribute */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Gallery input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
