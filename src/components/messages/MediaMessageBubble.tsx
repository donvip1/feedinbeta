import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Download, Image as ImageIcon, Film, FileText, Mic, X, RefreshCw, Play, Pause, Eye } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface MediaMessageBubbleProps {
  mediaUrl: string;
  mediaType: string;
  fileSize?: number;
  isOwn: boolean;
  onDownloadComplete?: () => void;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getMediaTypeLabel = (type: string): string => {
  if (type.startsWith('image')) return 'Photo';
  if (type.startsWith('video')) return 'Video';
  if (type.startsWith('audio')) return 'Voice message';
  return 'File';
};

const getMediaIcon = (type: string) => {
  if (type.startsWith('image')) return ImageIcon;
  if (type.startsWith('video')) return Film;
  if (type.startsWith('audio')) return Mic;
  return FileText;
};

export const MediaMessageBubble = ({
  mediaUrl,
  mediaType,
  fileSize,
  isOwn,
  onDownloadComplete,
}: MediaMessageBubbleProps) => {
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadedMediaUrl, setLoadedMediaUrl] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | undefined>(fileSize);

  const MediaIcon = getMediaIcon(mediaType);
  const label = getMediaTypeLabel(mediaType);
  const sizeText = formatFileSize(estimatedSize);

  // Fetch media with progress
  const handleDownload = async () => {
    if (downloadState === 'downloading') return;
    
    setDownloadState('downloading');
    setDownloadProgress(0);

    try {
      const response = await fetch(mediaUrl);
      
      if (!response.ok) throw new Error('Failed to fetch media');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength) : 0;
      
      if (total && !estimatedSize) {
        setEstimatedSize(total);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const chunks: ArrayBuffer[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value.buffer as ArrayBuffer);
        received += value.length;
        
        if (total) {
          setDownloadProgress(Math.round((received / total) * 100));
        } else {
          // Simulate progress if content-length not available
          setDownloadProgress(Math.min(90, received / 10000));
        }
      }

      const blob = new Blob(chunks, { type: mediaType });
      const objectUrl = URL.createObjectURL(blob);
      
      setLoadedMediaUrl(objectUrl);
      setDownloadProgress(100);
      setDownloadState('downloaded');
      onDownloadComplete?.();
    } catch (error) {
      console.error('Download error:', error);
      setDownloadState('error');
    }
  };

  // Render downloaded media
  if (downloadState === 'downloaded' && loadedMediaUrl) {
    if (mediaType.startsWith('image')) {
      return (
        <>
          <div 
            className="relative group/media overflow-hidden rounded-xl mb-1 cursor-pointer"
            onClick={() => setShowFullscreen(true)}
          >
            <img 
              src={loadedMediaUrl} 
              alt="Shared" 
              className="max-w-[280px] max-h-[320px] object-cover rounded-xl transition-transform duration-200 group-hover/media:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white/80 text-xs bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
              <Eye className="w-3 h-3" />
              <span>Tap to view</span>
            </div>
          </div>
          
          {/* Fullscreen viewer */}
          <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
              <img 
                src={loadedMediaUrl} 
                alt="Fullscreen" 
                className="w-full h-full object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={() => setShowFullscreen(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    if (mediaType.startsWith('video')) {
      return (
        <div className="relative overflow-hidden rounded-xl mb-1">
          <video 
            src={loadedMediaUrl} 
            controls 
            className="max-w-[280px] max-h-[320px] rounded-xl"
            playsInline
          />
        </div>
      );
    }

    if (mediaType.startsWith('audio')) {
      return (
        <div className="mb-1 min-w-[200px]">
          <audio src={loadedMediaUrl} controls className="w-full" />
        </div>
      );
    }

    // Generic file - offer download
    return (
      <a 
        href={loadedMediaUrl}
        download
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl mb-1 transition-all",
          isOwn 
            ? "bg-white/10 hover:bg-white/20" 
            : "bg-primary/5 hover:bg-primary/10"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isOwn ? "bg-white/20" : "bg-primary/10"
        )}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">File downloaded</p>
          {sizeText && <p className="text-xs opacity-70">{sizeText}</p>}
        </div>
        <Download className="w-5 h-5 opacity-70" />
      </a>
    );
  }

  // Render placeholder with tap to download
  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-xl mb-1 cursor-pointer",
        "min-w-[200px] min-h-[80px]"
      )}
      onClick={downloadState === 'error' ? handleDownload : (downloadState === 'idle' ? handleDownload : undefined)}
    >
      {/* Blurred background placeholder */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center",
        isOwn 
          ? "bg-white/10 backdrop-blur-sm" 
          : "bg-primary/5 backdrop-blur-sm"
      )}>
        {/* Pattern based on media type */}
        {mediaType.startsWith('image') && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        {mediaType.startsWith('video') && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-primary/5" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 gap-3">
        {downloadState === 'idle' && (
          <>
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all",
              isOwn ? "bg-white/20" : "bg-primary/20"
            )}>
              <MediaIcon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className={cn(
                "text-sm font-medium",
                isOwn ? "text-white" : "text-foreground"
              )}>
                {label} {sizeText && `• ${sizeText}`}
              </p>
              <p className={cn(
                "text-xs mt-1 flex items-center gap-1 justify-center",
                isOwn ? "text-white/70" : "text-muted-foreground"
              )}>
                <Download className="w-3 h-3" />
                Tap to download
              </p>
            </div>
          </>
        )}

        {downloadState === 'downloading' && (
          <>
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center relative",
              isOwn ? "bg-white/20" : "bg-primary/20"
            )}>
              <div className="absolute inset-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-20"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - downloadProgress / 100)}`}
                    className={cn(
                      "transition-all duration-300",
                      isOwn ? "text-white" : "text-primary"
                    )}
                  />
                </svg>
              </div>
              <span className={cn(
                "text-xs font-bold z-10",
                isOwn ? "text-white" : "text-primary"
              )}>
                {downloadProgress}%
              </span>
            </div>
            <p className={cn(
              "text-xs",
              isOwn ? "text-white/70" : "text-muted-foreground"
            )}>
              Downloading...
            </p>
          </>
        )}

        {downloadState === 'error' && (
          <>
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center",
              "bg-destructive/20"
            )}>
              <RefreshCw className="w-6 h-6 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-destructive">Download failed</p>
              <p className={cn(
                "text-xs mt-1",
                isOwn ? "text-white/70" : "text-muted-foreground"
              )}>
                Tap to retry
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
