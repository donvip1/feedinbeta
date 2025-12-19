import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  MoreVertical, 
  Edit3, 
  Share2, 
  Download, 
  Trash2, 
  Scissors,
  X,
  Play,
  Pause
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
import { downloadManager, formatFileSize } from '@/lib/download-manager';
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
  fileSize,
  isOwn = false,
  onEdit,
  onDelete,
  onCreateSticker,
}: ChatMediaViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const { haptic } = useNativeFeatures();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const isImage = mediaType.startsWith('image');
  const isVideo = mediaType.startsWith('video');

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
        // First download the media
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const file = new File([blob], `FeedIn_media.${mediaType.split('/')[1]}`, { type: mediaType });
        
        await navigator.share({
          files: [file]
        });
      } else {
        // Fallback: copy URL
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
    setShowControls(!showControls);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black"
        onClick={toggleControls}
      >
        {/* Header */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 z-10 safe-area-top"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Media Content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isImage && (
            <motion.img
              src={mediaUrl}
              alt="Media"
              className="max-w-full max-h-full object-contain select-none"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              draggable={false}
            />
          )}
          
          {isVideo && (
            <div className="relative w-full h-full flex items-center justify-center">
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
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVideoToggle();
                  }}
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </motion.button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
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
