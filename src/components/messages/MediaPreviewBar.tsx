import React, { useEffect, useState } from 'react';
import { X, FileText, Image as ImageIcon, Video, File, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MediaPreviewBarProps {
  file: File;
  onRemove: () => void;
  className?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return Video;
  if (type.startsWith('audio/')) return Music;
  if (type.includes('pdf')) return FileText;
  return File;
};

export const MediaPreviewBar = ({ file, onRemove, className }: MediaPreviewBarProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const FileIcon = getFileIcon(file.type);

  useEffect(() => {
    if (isImage || isVideo) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage, isVideo]);

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 bg-slate-900/80 backdrop-blur-lg border-t border-slate-700/50",
      className
    )}>
      {/* Preview thumbnail */}
      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-800/50 flex-shrink-0">
        {isImage && preview ? (
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        ) : isVideo && preview ? (
          <video 
            src={preview} 
            className="w-full h-full object-cover"
            muted
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileIcon className="w-6 h-6 text-slate-400" />
          </div>
        )}
        
        {/* Semi-transparent overlay for images/videos */}
        {(isImage || isVideo) && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {file.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">
            {formatFileSize(file.size)}
          </span>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-400 capitalize">
            {isImage ? 'Image' : isVideo ? 'Video' : file.type.split('/')[1]?.toUpperCase() || 'File'}
          </span>
        </div>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-full"
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};
