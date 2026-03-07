import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ArrowLeft, MoreVertical, Edit3, Share2, Download, Trash2, Scissors,
  Play, Pause, Maximize, Minimize, Volume2, VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
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

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const ChatMediaViewer = ({
  isOpen, onClose, mediaUrl, mediaType,
  senderName = 'Unknown', timestamp,
  isOwn = false, onEdit, onDelete, onCreateSticker,
}: ChatMediaViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [swipeY, setSwipeY] = useState(0);
  const [swipeStartY, setSwipeStartY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { haptic } = useNativeFeatures();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout>();
  
  // Pinch-to-zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  const isImage = mediaType.startsWith('image');
  const isVideo = mediaType.startsWith('video');

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setSwipeY(0);
      setIsPlaying(false);
      setCurrentTime(0);
      setMenuOpen(false);
    }
  }, [isOpen]);

  // Auto-hide controls for video
  useEffect(() => {
    if (isVideo && isPlaying && showControls) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(controlsTimerRef.current);
    }
  }, [isVideo, isPlaying, showControls]);

  // Video time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onTimeUpdate = () => !isSeeking && setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => { setIsPlaying(false); setShowControls(true); };
    
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
    };
  }, [isSeeking, isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menuOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, menuOpen, onClose]);

  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0]?.clientX || 0, y: touches[0]?.clientY || 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setLastTouchDistance(getTouchDistance(e.touches));
      setLastTouchCenter(getTouchCenter(e.touches));
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        setIsDragging(true);
        setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      } else {
        setSwipeStartY(e.touches[0].clientY);
      }
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      const newCenter = getTouchCenter(e.touches);
      if (lastTouchDistance > 0) {
        const scaleChange = newDistance / lastTouchDistance;
        const newScale = Math.max(1, Math.min(5, scale * scaleChange));
        setScale(newScale);
        if (newScale > 1) {
          const dx = newCenter.x - lastTouchCenter.x;
          const dy = newCenter.y - lastTouchCenter.y;
          setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        }
      }
      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const dx = e.touches[0].clientX - lastTouchCenter.x;
      const dy = e.touches[0].clientY - lastTouchCenter.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastTouchCenter({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 1 && scale === 1 && swipeStartY) {
      const dy = e.touches[0].clientY - swipeStartY;
      if (dy > 0) setSwipeY(dy);
    }
  }, [lastTouchDistance, lastTouchCenter, scale, isDragging, swipeStartY]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setLastTouchDistance(0);
    setIsDragging(false);
    
    if (swipeY > 120) {
      haptic('light');
      onClose();
      setSwipeY(0);
      return;
    }
    setSwipeY(0);
    setSwipeStartY(0);
    
    if (scale < 1) { setScale(1); setPosition({ x: 0, y: 0 }); }
    if (scale === 1) setPosition({ x: 0, y: 0 });

    if (e.touches.length === 0 && e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (scale > 1) { setScale(1); setPosition({ x: 0, y: 0 }); }
        else {
          setScale(2.5);
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
  }, [scale, lastTap, haptic, swipeY, onClose]);

  const handleSave = async () => {
    haptic('medium');
    try {
      const download = await downloadManager.downloadMedia(
        mediaUrl, `FeedIn_${Date.now()}.${mediaType.split('/')[1] || 'file'}`, mediaType
      );
      if (download.blob) {
        await downloadManager.saveToDevice(download.blob, `FeedIn_${Date.now()}.${mediaType.split('/')[1] || 'file'}`);
        toast.success('Saved to device');
      }
    } catch { toast.error('Failed to save'); }
  };

  const handleShare = async () => {
    haptic('light');
    try {
      if (navigator.share) {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const file = new File([blob], `FeedIn_media.${mediaType.split('/')[1]}`, { type: mediaType });
        await navigator.share({ files: [file] });
      } else {
        await navigator.clipboard.writeText(mediaUrl);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('Share failed');
    }
  };

  const handleVideoToggle = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
      setShowControls(true);
    }
  };

  const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
    if (!progressRef.current || !videoRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    videoRef.current.currentTime = percent * duration;
    setCurrentTime(percent * duration);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch { /* fullscreen not supported */ }
  };

  const toggleControls = () => {
    if (scale === 1 && !menuOpen) setShowControls(!showControls);
  };

  if (!isOpen) return null;

  const opacity = swipeY > 0 ? Math.max(0.3, 1 - swipeY / 300) : 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-200"
      style={{ opacity }}
    >
      {/* Header */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 z-10 safe-area-top animate-in slide-in-from-top duration-150">
          <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost" size="icon"
                className="text-white hover:bg-white/20 h-9 w-9"
                onClick={(e) => { e.stopPropagation(); haptic('light'); onClose(); }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <p className="text-white font-medium text-sm">{senderName}</p>
                {timestamp && <p className="text-white/60 text-[10px]">{timestamp}</p>}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"
                  className="text-white hover:bg-white/20 h-9 w-9"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {isImage && onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSave}>
                  <Download className="w-3.5 h-3.5 mr-2" /> Save to device
                </DropdownMenuItem>
                {isImage && onCreateSticker && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onCreateSticker}>
                      <Scissors className="w-3.5 h-3.5 mr-2" /> Create sticker
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Media Content */}
      <div 
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          touchAction: scale > 1 ? 'none' : 'pan-y',
          transform: swipeY > 0 ? `translateY(${swipeY}px)` : undefined,
          transition: swipeY === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {isImage && (
          <img
            src={mediaUrl} alt="Media"
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
              muted={isMuted}
              onClick={(e) => { e.stopPropagation(); handleVideoToggle(); }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Center play button when paused */}
            {!isPlaying && (
              <button
                className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-150"
                onClick={(e) => { e.stopPropagation(); handleVideoToggle(); }}
              >
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-7 h-7 text-white ml-0.5" />
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Zoom indicator */}
      {scale > 1 && showControls && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/60 px-2.5 py-0.5 rounded-full text-white text-xs backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Video Controls Bar */}
      {isVideo && showControls && (
        <div className="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom animate-in slide-in-from-bottom duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-3 px-4">
            {/* Progress bar */}
            <div 
              ref={progressRef}
              className="relative h-6 flex items-center cursor-pointer group mb-2"
              onClick={handleSeek}
              onTouchStart={() => setIsSeeking(true)}
              onTouchMove={handleSeek}
              onTouchEnd={() => setIsSeeking(false)}
            >
              <div className="absolute inset-x-0 h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all">
                <div 
                  className="h-full bg-white rounded-full relative"
                  style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
            
            {/* Controls row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={handleVideoToggle} className="text-white active:scale-90 transition-transform">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={() => setIsMuted(!isMuted)} className="text-white/80 active:scale-90 transition-transform">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <span className="text-white/80 text-[11px] font-medium tabular-nums">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>
              <button onClick={toggleFullscreen} className="text-white/80 active:scale-90 transition-transform">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image bottom action bar */}
      {!isVideo && showControls && (
        <div className="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center justify-around px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
            {isImage && onEdit && (
              <ActionButton icon={Edit3} label="Edit" onClick={(e) => { e.stopPropagation(); haptic('light'); onEdit(); }} />
            )}
            <ActionButton icon={Share2} label="Share" onClick={(e) => { e.stopPropagation(); handleShare(); }} />
            <ActionButton icon={Download} label="Save" onClick={(e) => { e.stopPropagation(); handleSave(); }} />
            {isImage && onCreateSticker && (
              <ActionButton icon={Scissors} label="Sticker" onClick={(e) => { e.stopPropagation(); haptic('light'); onCreateSticker(); }} />
            )}
            {onDelete && (
              <ActionButton icon={Trash2} label="Delete" onClick={(e) => { e.stopPropagation(); haptic('light'); onDelete(); }} destructive />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ 
  icon: Icon, label, onClick, destructive = false 
}: { 
  icon: React.ElementType; label: string;
  onClick: (e: React.MouseEvent) => void; destructive?: boolean;
}) => (
  <button className="flex flex-col items-center gap-0.5 p-1.5 active:scale-95 transition-transform" onClick={onClick}>
    <div className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center",
      destructive ? "bg-destructive/20" : "bg-white/10"
    )}>
      <Icon className={cn("w-4 h-4", destructive ? "text-destructive" : "text-white")} />
    </div>
    <span className={cn("text-[10px]", destructive ? "text-destructive" : "text-white/80")}>{label}</span>
  </button>
);
