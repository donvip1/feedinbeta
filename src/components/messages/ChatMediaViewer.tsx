import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ArrowLeft, 
  MoreVertical, 
  Edit3, 
  Share2, 
  Download, 
  Trash2, 
  Scissors,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { downloadManager } from '@/lib/download-manager';
import { toast } from 'sonner';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface ChatMediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: string;
  senderName?: string;
  timestamp?: string;
  fileSize?: number;
  isOwn?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCreateSticker?: () => void;
}

export const ChatMediaViewer = ({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  senderName = 'Unknown',
  timestamp,
  isOwn = false,
  onEdit,
  onDelete,
  onCreateSticker,
}: ChatMediaViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const { haptic } = useNativeFeatures();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Pinch-to-zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isImage = mediaType.startsWith('image');
  const isVideo = mediaType.startsWith('video');

  // Reset zoom when opening/closing
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate center point between two touches
  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {
    if (touches.length < 2) return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      e.preventDefault();
      setLastTouchDistance(getTouchDistance(e.touches));
      setLastTouchCenter(getTouchCenter(e.touches));
      setIsDragging(false);
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan start when zoomed
      setIsDragging(true);
      setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);
      
      if (lastTouchDistance > 0) {
        const scaleChange = newDistance / lastTouchDistance;
        const newScale = Math.max(1, Math.min(5, scale * scaleChange));
        setScale(newScale);
        
        // Adjust position based on pinch center movement
        if (newScale > 1) {
          const dx = newCenter.x - lastTouchCenter.x;
          const dy = newCenter.y - lastTouchCenter.y;
          setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        }
      }
      
      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan when zoomed
      const dx = e.touches[0].clientX - lastTouchCenter.x;
      const dy = e.touches[0].clientY - lastTouchCenter.y;
      
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [lastTouchDistance, lastTouchCenter, scale, isDragging]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setLastTouchDistance(0);
    setIsDragging(false);
    
    // Snap back if zoomed out too much
    if (scale < 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
    
    // Reset position if at 1x scale
    if (scale === 1) {
      setPosition({ x: 0, y: 0 });
    }

    // Double-tap to zoom
    if (e.touches.length === 0 && e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        // Double tap detected
        if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          setScale(2.5);
          // Center zoom on tap position
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.changedTouches[0].clientX - rect.left - rect.width / 2;
            const y = e.changedTouches[0].clientY - rect.top - rect.height / 2;
            setPosition({ x: -x * 0.5, y: -y * 0.5 });
          }
        }
        haptic('light');
      }
      setLastTap(now);
    }
  }, [scale, lastTap, haptic]);

  const handleSave = async () => {
    haptic('medium');
    
    try {
      const download = await downloadManager.downloadMedia(
        mediaUrl,
        `FeedIn_${Date.now()}.${mediaType.split('/')[1] || 'file'}`,
        mediaType
      );
      
      if (download.blob) {
        await downloadManager.saveToDevice(
          download.blob,
          `FeedIn_${Date.now()}.${mediaType.split('/')[1] || 'file'}`
        );
        toast.success('Saved to device');
      }
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const handleShare = async () => {
    haptic('light');
    
    try {
      if (navigator.share) {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const file = new File([blob], `FeedIn_media.${mediaType.split('/')[1]}`, { type: mediaType });
        
        await navigator.share({
          files: [file]
        });
      } else {
        await navigator.clipboard.writeText(mediaUrl);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Share failed');
      }
    }
  };

  const handleVideoToggle = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleControls = () => {
    // Only toggle controls if not zoomed in (to avoid accidental toggles during pan)
    if (scale === 1) {
      setShowControls(!showControls);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-200"
      onClick={toggleControls}
    >
      {/* Header */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 z-10 safe-area-top animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-10 w-10"
                onClick={(e) => {
                  e.stopPropagation();
                  haptic('light');
                  onClose();
                }}
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              
              <div>
                <p className="text-white font-medium">{senderName}</p>
                {timestamp && (
                  <p className="text-white/60 text-xs">{timestamp}</p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-10 w-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isImage && onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSave}>
                  <Download className="w-4 h-4 mr-2" />
                  Save to device
                </DropdownMenuItem>
                {isImage && onCreateSticker && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onCreateSticker}>
                      <Scissors className="w-4 h-4 mr-2" />
                      Create sticker
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Media Content with Pinch-to-Zoom */}
      <div 
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
      >
        {isImage && (
          <img
            src={mediaUrl}
            alt="Media"
            className="max-w-full max-h-full object-contain select-none animate-in zoom-in-95 duration-200"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            draggable={false}
          />
        )}
        
        {isVideo && (
          <div 
            className="relative w-full h-full flex items-center justify-center"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <video
              ref={videoRef}
              src={mediaUrl}
              className="max-w-full max-h-full object-contain"
              playsInline
              onClick={(e) => {
                e.stopPropagation();
                handleVideoToggle();
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {!isPlaying && (
              <button
                className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVideoToggle();
                }}
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Zoom indicator */}
      {scale > 1 && showControls && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-white text-sm backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Bottom Action Bar */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-around p-4 bg-gradient-to-t from-black/80 to-transparent">
            {isImage && onEdit && (
              <ActionButton 
                icon={Edit3} 
                label="Edit" 
                onClick={(e) => {
                  e.stopPropagation();
                  haptic('light');
                  onEdit();
                }} 
              />
            )}
            <ActionButton 
              icon={Share2} 
              label="Share" 
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }} 
            />
            <ActionButton 
              icon={Download} 
              label="Save" 
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }} 
            />
            {isImage && onCreateSticker && (
              <ActionButton 
                icon={Scissors} 
                label="Sticker" 
                onClick={(e) => {
                  e.stopPropagation();
                  haptic('light');
                  onCreateSticker();
                }} 
              />
            )}
            {onDelete && (
              <ActionButton 
                icon={Trash2} 
                label="Delete" 
                onClick={(e) => {
                  e.stopPropagation();
                  haptic('light');
                  onDelete();
                }} 
                destructive 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ 
  icon: Icon, 
  label, 
  onClick, 
  destructive = false 
}: { 
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  destructive?: boolean;
}) => (
  <button
    className="flex flex-col items-center gap-1 p-2 active:scale-95 transition-transform"
    onClick={onClick}
  >
    <div className={cn(
      "w-12 h-12 rounded-full flex items-center justify-center",
      destructive ? "bg-destructive/20" : "bg-white/10"
    )}>
      <Icon className={cn(
        "w-5 h-5",
        destructive ? "text-destructive" : "text-white"
      )} />
    </div>
    <span className={cn(
      "text-xs",
      destructive ? "text-destructive" : "text-white/80"
    )}>
      {label}
    </span>
  </button>
);