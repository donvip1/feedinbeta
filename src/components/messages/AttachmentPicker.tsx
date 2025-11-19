import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Image, Video, FileText, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AttachmentPickerProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'file') => void;
  onLocationSelect?: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB

export const AttachmentPicker = ({ 
  onFileSelect, 
  onLocationSelect, 
  disabled 
}: AttachmentPickerProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'file'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 150MB',
        variant: 'destructive',
      });
      return;
    }

    onFileSelect(file, type);
    e.target.value = ''; // Reset input
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="grid gap-1">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => imageInputRef.current?.click()}
            >
              <Image className="w-4 h-4 mr-2" />
              Images
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => videoInputRef.current?.click()}
            >
              <Video className="w-4 h-4 mr-2" />
              Videos
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="w-4 h-4 mr-2" />
              Files
            </Button>
            {onLocationSelect && (
              <Button
                variant="ghost"
                className="justify-start"
                onClick={onLocationSelect}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Location
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'video')}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'file')}
      />
    </>
  );
};
