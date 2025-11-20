import { Camera, Image, Radio } from 'lucide-react';

interface PostCreationSelectorProps {
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  onStorySelect: () => void;
  onClose: () => void;
}

export default function PostCreationSelector({
  onCameraSelect,
  onGallerySelect,
  onStorySelect,
  onClose,
}: PostCreationSelectorProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-end justify-center">
      <div className="w-full max-w-sm bg-card rounded-t-3xl p-6 space-y-4 animate-slide-up border-t border-border">
        <div className="w-12 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-6" />
        
        <button
          onClick={onCameraSelect}
          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-foreground">Camera</h3>
            <p className="text-sm text-muted-foreground">Take a photo or video</p>
          </div>
        </button>

        <button
          onClick={onGallerySelect}
          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Image className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-foreground">Gallery</h3>
            <p className="text-sm text-muted-foreground">Choose from your photos</p>
          </div>
        </button>

        <button
          onClick={onStorySelect}
          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-muted transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Radio className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-foreground">Story</h3>
            <p className="text-sm text-muted-foreground">Share a 24-hour story</p>
          </div>
        </button>

        <button
          onClick={onClose}
          className="w-full py-3 text-center text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
