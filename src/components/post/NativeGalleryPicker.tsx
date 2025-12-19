import { useRef, useState, useCallback, useEffect } from 'react';
import { X, Camera, Check, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  file: File;
  duration?: number;
}

interface NativeGalleryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (items: MediaItem[]) => void;
  onCameraOpen: () => void;
  maxSelection?: number;
  allowMultiple?: boolean;
}

export default function NativeGalleryPicker({
  open,
  onClose,
  onSelect,
  onCameraOpen,
  maxSelection = 10,
  allowMultiple = true,
}: NativeGalleryPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const triggerHaptic = useCallback(async (type: 'light' | 'medium' = 'light') => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: type === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'light' ? 10 : 20);
      }
    } catch {}
  }, []);

  // Open file picker on mount
  useEffect(() => {
    if (open && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [open]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      onClose();
      return;
    }

    setIsLoading(true);

    const items: MediaItem[] = [];
    for (const file of files.slice(0, maxSelection)) {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      
      let duration: number | undefined;
      if (isVideo) {
        duration = await getVideoDuration(url);
      }

      items.push({
        url,
        type: isVideo ? 'video' : 'image',
        file,
        duration,
      });
    }

    setIsLoading(false);
    
    if (allowMultiple) {
      setSelectedItems(items);
    } else {
      // Single selection - proceed immediately
      triggerHaptic('medium');
      onSelect(items.slice(0, 1));
    }

    // Reset input
    e.target.value = '';
  }, [maxSelection, allowMultiple, onSelect, onClose, triggerHaptic]);

  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(Math.floor(video.duration));
      };
      video.onerror = () => resolve(0);
      video.src = url;
    });
  };

  const toggleSelection = useCallback((item: MediaItem) => {
    triggerHaptic('light');
    setSelectedItems(prev => {
      const exists = prev.find(i => i.url === item.url);
      if (exists) {
        return prev.filter(i => i.url !== item.url);
      }
      if (prev.length >= maxSelection) {
        return prev;
      }
      return [...prev, item];
    });
  }, [maxSelection, triggerHaptic]);

  const handleConfirm = useCallback(() => {
    if (selectedItems.length > 0) {
      triggerHaptic('medium');
      onSelect(selectedItems);
    }
  }, [selectedItems, onSelect, triggerHaptic]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple={allowMultiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-xl safe-area-top">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <h1 className="text-lg font-semibold text-white">
          {allowMultiple ? 'Select Media' : 'Choose Photo'}
        </h1>

        {allowMultiple && selectedItems.length > 0 && (
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-primary rounded-full text-white font-medium active:scale-95 transition-transform"
          >
            Next ({selectedItems.length})
          </button>
        )}

        {(selectedItems.length === 0 || !allowMultiple) && (
          <div className="w-20" /> // Spacer
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Selected items preview (multi-select mode) */}
      {allowMultiple && selectedItems.length > 0 && (
        <div className="bg-black/60 backdrop-blur-xl">
          {/* Preview grid */}
          <div className="grid grid-cols-3 gap-1 p-4">
            {selectedItems.map((item, index) => (
              <div
                key={item.url}
                className="relative aspect-square rounded-lg overflow-hidden"
              >
                {item.type === 'video' ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Selection number badge */}
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{index + 1}</span>
                </div>

                {/* Video duration */}
                {item.type === 'video' && item.duration && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
                    <Play className="w-3 h-3" />
                    {formatDuration(item.duration)}
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => toggleSelection(item)}
                  className="absolute top-2 left-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>

          {/* Add more button */}
          {selectedItems.length < maxSelection && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 text-center text-primary font-medium hover:bg-white/5 transition-colors"
            >
              Add more ({selectedItems.length}/{maxSelection})
            </button>
          )}
        </div>
      )}

      {/* Empty state / Camera option */}
      {!isLoading && selectedItems.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-white/60">No media selected</p>
            <p className="text-white/40 text-sm">Choose from your gallery or take a new photo</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-white/10 rounded-xl text-white font-medium active:scale-95 transition-transform"
            >
              Choose from Gallery
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                onCameraOpen();
              }}
              className="px-6 py-3 bg-primary rounded-xl text-white font-medium active:scale-95 transition-transform flex items-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
