import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Image, FileText, MapPin, Music, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AttachmentPickerProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'file') => void;
  onLocationSelect?: () => void;
  disabled?: boolean;
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
  disabled 
}: AttachmentPickerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
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

    // Determine actual type from file
    let type = currentType;
    if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('image/')) type = 'image';
    else type = 'file';

    onFileSelect(file, type);
    e.target.value = '';
    setIsExpanded(false);
  };

  const handleItemClick = (item: typeof mediaItems[0]) => {
    setCurrentType(item.type);
    setCurrentAccept(item.accept);
    // Use setTimeout to ensure state is set before click
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  return (
    <>
      {/* Expanded MediaDock */}
      {isExpanded && (
        <div className="absolute bottom-full left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 animate-fade-in">
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-4 px-4">
            {mediaItems.map((item, i) => (
              <button 
                key={i} 
                onClick={() => handleItemClick(item)} 
                className="flex flex-col items-center gap-2 flex-shrink-0 group"
                disabled={disabled}
              >
                <div className={cn(
                  "w-14 h-14 text-white rounded-2xl flex items-center justify-center shadow-lg group-active:scale-90 transition-transform",
                  item.color
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{item.label}</span>
              </button>
            ))}
            {onLocationSelect && (
              <button 
                onClick={() => { onLocationSelect(); setIsExpanded(false); }}
                className="flex flex-col items-center gap-2 flex-shrink-0 group"
              >
                <div className="w-14 h-14 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Location</span>
              </button>
            )}
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "shrink-0 rounded-2xl transition-all",
          isExpanded 
            ? "bg-foreground text-background hover:bg-foreground/90" 
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        <Plus className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-45")} />
      </Button>

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
