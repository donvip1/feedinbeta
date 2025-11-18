import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Upload, Image as ImageIcon, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MediaGalleryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: File[]) => void;
}

export function MediaGalleryPicker({ open, onClose, onSelect }: MediaGalleryPickerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0]; // Only single selection
    const type = file.type.startsWith('video/') ? 'video' : 'image';

    // Validation
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 100MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setMediaType(type);
    setPreview(URL.createObjectURL(file));
  };

  const handleNext = () => {
    if (selectedFile) {
      onSelect([selectedFile]);
    }
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full md:max-w-4xl h-[100dvh] md:h-[90vh] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">Select Media</h2>
          <Button 
            onClick={handleNext}
            disabled={!selectedFile}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
          >
            Next
          </Button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Content */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {!preview ? (
            // Empty State
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-accent/50 flex items-center justify-center mb-6">
                <Upload className="w-16 h-16 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Select media from your device</h3>
              <p className="text-muted-foreground mb-8 text-center max-w-md">
                Choose photos or videos from your gallery to share
              </p>
              <Button
                onClick={handleBrowse}
                size="lg"
                className="px-8"
              >
                Browse Files
              </Button>
              <div className="mt-8 flex gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>Images: JPG, PNG, GIF</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  <span>Videos: MP4, MOV</span>
                </div>
              </div>
            </div>
          ) : (
            // Preview State
            <div className="flex-1 flex flex-col">
              <div className="flex-1 relative bg-black rounded-xl overflow-hidden mb-4">
                {mediaType === 'image' ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src={preview}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    loop
                    muted
                  />
                )}

                {/* Media Type Badge */}
                <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                  {mediaType === 'image' ? (
                    <>
                      <ImageIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Image</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Video</span>
                    </>
                  )}
                </div>

                {/* Clear Button */}
                <button
                  onClick={clearSelection}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* File Info */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{selectedFile?.name}</span>
                <span>{(selectedFile!.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>

              {/* Change File Button */}
              <Button
                onClick={handleBrowse}
                variant="outline"
                className="mt-4 w-full"
              >
                Choose Different File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
