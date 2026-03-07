import React, { useRef, useState } from 'react';
import { Camera, Image, FileText, MapPin, Music } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AttachmentPickerProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'file') => void;
  onLocationSelect?: () => void;
  disabled?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB

const mediaItems = [
  { icon: Camera, label: 'Camera', color: 'bg-blue-500', type: 'image' as const, accept: 'image/*' },
  { icon: Image, label: 'Gallery', color: 'bg-purple-500', type: 'image' as const, accept: 'image/*,video/*' },
  { icon: FileText, label: 'Document', color: 'bg-orange-500', type: 'file' as const, accept: '*/*' },
  { icon: Music, label: 'Audio', color: 'bg-pink-500', type: 'file' as const, accept: 'audio/*' },
];

export const AttachmentPicker = ({ 
  onFileSelect, 
  onLocationSelect, 
  disabled,
  isExpanded,
  onToggle,
}: AttachmentPickerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentType, setCurrentType] = useState<'image' | 'video' | 'file'>('image');
  const [currentAccept, setCurrentAccept] = useState('image/*');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 150MB',
        variant: 'destructive',
      });
      return;
    }

    let type = currentType;
    if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('image/')) type = 'image';
    else type = 'file';

    onFileSelect(file, type);
    e.target.value = '';
    onToggle();
  };

  const handleItemClick = (item: typeof mediaItems[0]) => {
    setCurrentType(item.type);
    setCurrentAccept(item.accept);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  if (!isExpanded) {
    return (
      <input
        ref={fileInputRef}
        type="file"
        accept={currentAccept}
        className="hidden"
        onChange={handleFileChange}
      />
    );
  }

  return (
    <>
      {/* MediaDock - renders ABOVE the input row */}
      <div className="bg-background/95 backdrop-blur-lg border-b border-border/30 animate-fade-in">
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-3 px-4">
          {mediaItems.map((item, i) => (
            <button 
              key={i} 
              onClick={() => handleItemClick(item)} 
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              disabled={disabled}
            >
              <div className={cn(
                "w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-lg group-active:scale-90 transition-transform",
                item.color
              )}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">{item.label}</span>
            </button>
          ))}
          {onLocationSelect && (
            <button 
              onClick={() => { onLocationSelect(); onToggle(); }}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Location</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={currentAccept}
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
};
