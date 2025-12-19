import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Check, X, Share2, FolderOpen } from 'lucide-react';
import { downloadManager, DownloadProgress } from '@/lib/download-manager';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const DownloadNotifications = () => {
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);

  useEffect(() => {
    const unsubscribe = downloadManager.subscribe(setDownloads);
    return () => { unsubscribe(); };
    return unsubscribe;
  }, []);

  if (downloads.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {downloads.map((download) => (
          <DownloadCard key={download.id} download={download} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const DownloadCard = ({ download }: { download: DownloadProgress }) => {
  const handleShare = async () => {
    if (!download.blob) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          files: [new File([download.blob], download.fileName, { type: download.fileType })]
        });
      }
    } catch (e) {
      console.log('Share cancelled');
    }
  };

  const handleOpen = () => {
    if (download.objectUrl) {
      window.open(download.objectUrl, '_blank');
    }
  };

  const handleDismiss = () => {
    downloadManager.clearDownload(download.id);
  };

  const isImage = download.fileType.startsWith('image');
  const isVideo = download.fileType.startsWith('video');

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      className="pointer-events-auto"
    >
      <div className={cn(
        "rounded-2xl p-3 shadow-lg backdrop-blur-xl border",
        "bg-card/95 border-border"
      )}>
        <div className="flex items-center gap-3">
          {/* Icon/Preview */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden",
            download.status === 'completed' ? "bg-green-500/20" : "bg-primary/20"
          )}>
            {download.status === 'completed' && download.objectUrl && isImage ? (
              <img 
                src={download.objectUrl} 
                alt="" 
                className="w-full h-full object-cover"
              />
            ) : download.status === 'completed' ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
              >
                <Check className="w-6 h-6 text-green-500" />
              </motion.div>
            ) : download.status === 'error' ? (
              <X className="w-6 h-6 text-destructive" />
            ) : (
              <Download className="w-6 h-6 text-primary animate-pulse" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {download.status === 'completed' ? 'Download complete' : 
               download.status === 'error' ? 'Download failed' : 'Downloading...'}
            </p>
            
            {download.status === 'downloading' && (
              <div className="mt-1.5">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${download.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {download.progress}%
                </p>
              </div>
            )}

            {download.status === 'completed' && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleOpen}
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1" />
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleShare}
                >
                  <Share2 className="w-3.5 h-3.5 mr-1" />
                  Share
                </Button>
              </div>
            )}
          </div>

          {/* Dismiss */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
