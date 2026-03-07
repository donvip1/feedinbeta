import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Download, Image as ImageIcon, Film, FileText, Mic, RefreshCw, Maximize2, Play } from 'lucide-react';
import { ChatMediaViewer } from './ChatMediaViewer';
import { CreateStickerModal } from './CreateStickerModal';
import { downloadManager, formatFileSize } from '@/lib/download-manager';
import { toast } from 'sonner';

interface MediaMessageBubbleProps {
  mediaUrl: string;
  mediaType: string;
  fileSize?: number;
  isOwn: boolean;
  senderName?: string;
  timestamp?: string;
  onDownloadComplete?: () => void;
  onDelete?: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
  messageId?: string;
}

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
  senderName,
  timestamp,
  onDownloadComplete,
  onDelete,
  onDeleteForMe,
  onDeleteForEveryone,
}: MediaMessageBubbleProps) => {
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'downloaded' | 'error'>(isOwn ? 'downloaded' : 'idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadedMediaUrl, setLoadedMediaUrl] = useState<string | null>(isOwn ? mediaUrl : null);
  const [showViewer, setShowViewer] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | undefined>(fileSize);

  useEffect(() => {
    if (isOwn && mediaUrl) {
      setLoadedMediaUrl(mediaUrl);
      setDownloadState('downloaded');
    }
  }, [isOwn, mediaUrl]);

  const MediaIcon = getMediaIcon(mediaType);
  const label = getMediaTypeLabel(mediaType);
  const sizeText = formatFileSize(estimatedSize);

  const handleDownload = async () => {
    if (downloadState === 'downloading') return;
    setDownloadState('downloading');
    setDownloadProgress(0);
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error('Failed to fetch media');
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength) : 0;
      if (total && !estimatedSize) setEstimatedSize(total);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      const chunks: ArrayBuffer[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value.buffer as ArrayBuffer);
        received += value.length;
        if (total) setDownloadProgress(Math.round((received / total) * 100));
        else setDownloadProgress(Math.min(90, received / 10000));
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

  const handleCloseViewer = () => {
    setShowViewer(false);
  };

  if (downloadState === 'downloaded' && loadedMediaUrl) {
    if (mediaType.startsWith('image')) {
      return (
        <>
          <div 
            className="relative group/media overflow-hidden rounded-lg mb-0.5 cursor-pointer"
            onClick={() => setShowViewer(true)}
          >
            <img 
              src={loadedMediaUrl} 
              alt="Shared" 
              className="w-full max-w-[260px] max-h-[340px] object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                <ImageIcon className="w-2.5 h-2.5 text-white/90" />
                {sizeText && <span className="text-[9px] font-medium text-white/90">{sizeText}</span>}
              </div>
              <button 
                className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowViewer(true); }}
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
          
          <ChatMediaViewer
            isOpen={showViewer}
            onClose={handleCloseViewer}
            mediaUrl={loadedMediaUrl}
            mediaType={mediaType}
            senderName={senderName}
            timestamp={timestamp}
            fileSize={estimatedSize}
            isOwn={isOwn}
            onEdit={() => toast.info('Image editor coming soon')}
            onDeleteForMe={() => { handleCloseViewer(); onDeleteForMe?.(); }}
            onDeleteForEveryone={isOwn ? () => { handleCloseViewer(); onDeleteForEveryone?.(); } : undefined}
            onDelete={onDelete ? () => { handleCloseViewer(); onDelete(); } : undefined}
            onCreateSticker={() => { handleCloseViewer(); setShowStickerModal(true); }}
          />

          <CreateStickerModal
            isOpen={showStickerModal}
            onClose={() => setShowStickerModal(false)}
            imageUrl={loadedMediaUrl}
            onStickerCreated={() => toast.success('Sticker saved!')}
          />
        </>
      );
    }

    if (mediaType.startsWith('video')) {
      return (
        <>
          <div 
            className="relative overflow-hidden rounded-lg mb-0.5 cursor-pointer"
            onClick={() => setShowViewer(true)}
          >
            <video 
              src={loadedMediaUrl} 
              className="w-full max-w-[260px] max-h-[360px] rounded-lg object-cover"
              playsInline muted preload="metadata"
            />
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-1.5 flex items-center justify-between z-10">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                <Film className="w-2.5 h-2.5 text-white/90" />
                {sizeText && <span className="text-[9px] font-medium text-white/90">{sizeText}</span>}
              </div>
              <button 
                className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm hover:bg-black/60 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowViewer(true); }}
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>

          <ChatMediaViewer
            isOpen={showViewer}
            onClose={handleCloseViewer}
            mediaUrl={loadedMediaUrl}
            mediaType={mediaType}
            senderName={senderName}
            timestamp={timestamp}
            fileSize={estimatedSize}
            isOwn={isOwn}
            onDeleteForMe={() => { handleCloseViewer(); onDeleteForMe?.(); }}
            onDeleteForEveryone={isOwn ? () => { handleCloseViewer(); onDeleteForEveryone?.(); } : undefined}
            onDelete={onDelete ? () => { handleCloseViewer(); onDelete(); } : undefined}
          />
        </>
      );
    }

    if (mediaType.startsWith('audio')) {
      return (
        <div className="mb-0.5 min-w-[180px]">
          <audio src={loadedMediaUrl} controls className="w-full h-8" />
        </div>
      );
    }

    return (
      <button 
        onClick={() => {
          if (loadedMediaUrl) {
            downloadManager.saveToDevice(new Blob([loadedMediaUrl]), `FeedIn_file_${Date.now()}`);
          }
        }}
        className={cn(
          "flex items-center gap-2.5 p-2.5 rounded-lg mb-0.5 transition-all w-full text-left",
          isOwn ? "bg-white/10 hover:bg-white/20" : "bg-primary/5 hover:bg-primary/10"
        )}
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", isOwn ? "bg-white/20" : "bg-primary/10")}>
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">File downloaded</p>
          {sizeText && <p className="text-[11px] opacity-70">{sizeText}</p>}
        </div>
        <Download className="w-4 h-4 opacity-70" />
      </button>
    );
  }

  // Placeholder with tap to download
  return (
    <div 
      className={cn("relative overflow-hidden rounded-lg mb-0.5 cursor-pointer", "min-w-[180px] min-h-[70px]")}
      onClick={downloadState === 'error' ? handleDownload : (downloadState === 'idle' ? handleDownload : undefined)}
    >
      <div className={cn(
        "absolute inset-0 flex items-center justify-center",
        isOwn ? "bg-white/10 backdrop-blur-sm" : "bg-primary/5 backdrop-blur-sm"
      )}>
        {mediaType.startsWith('image') && <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />}
        {mediaType.startsWith('video') && <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-primary/5" />}
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center p-5 gap-2.5">
        {downloadState === 'idle' && (
          <>
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-all", isOwn ? "bg-white/20" : "bg-primary/20")}>
              <MediaIcon className="w-5 h-5" />
            </div>
            <div className="text-center">
              <p className={cn("text-[13px] font-medium", isOwn ? "text-white" : "text-foreground")}>{label} {sizeText && `• ${sizeText}`}</p>
              <p className={cn("text-[11px] mt-0.5 flex items-center gap-1 justify-center", isOwn ? "text-white/70" : "text-muted-foreground")}>
                <Download className="w-2.5 h-2.5" /> Tap to download
              </p>
            </div>
          </>
        )}
        {downloadState === 'downloading' && (
          <>
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center relative", isOwn ? "bg-white/20" : "bg-primary/20")}>
              <div className="absolute inset-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - downloadProgress / 100)}`}
                    className={cn("transition-all duration-300", isOwn ? "text-white" : "text-primary")}
                  />
                </svg>
              </div>
              <span className={cn("text-[10px] font-bold z-10", isOwn ? "text-white" : "text-primary")}>{downloadProgress}%</span>
            </div>
            <p className={cn("text-[11px]", isOwn ? "text-white/70" : "text-muted-foreground")}>Downloading...</p>
          </>
        )}
        {downloadState === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-destructive/20">
              <RefreshCw className="w-5 h-5 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium text-destructive">Download failed</p>
              <p className={cn("text-[11px] mt-0.5", isOwn ? "text-white/70" : "text-muted-foreground")}>Tap to retry</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
