import { useState, useRef } from 'react';
import { X, Upload, Video, Image as ImageIcon, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface MediaGalleryPickerProps {
  onClose: () => void;
  onSelect: (files: { url: string; type: 'image' | 'video'; file: File }[]) => void;
  maxFiles?: number;
  allowMultiple?: boolean;
}

export default function MediaGalleryPicker({
  onClose,
  onSelect,
  maxFiles = 10,
  allowMultiple = true,
}: MediaGalleryPickerProps) {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<{ url: string; type: 'image' | 'video'; file: File }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Check if total would exceed max
    if (selectedFiles.length + files.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `You can only select up to ${maxFiles} files`,
        variant: 'destructive',
      });
      return;
    }

    const newFiles = files.map(file => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      return {
        url: URL.createObjectURL(file),
        type: type as 'image' | 'video',
        file,
      };
    });

    if (allowMultiple) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
    } else {
      setSelectedFiles(newFiles.slice(0, 1));
    }
  };

  const handleRemove = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].url);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleNext = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file',
        variant: 'destructive',
      });
      return;
    }
    onSelect(selectedFiles);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={onClose} className="text-foreground">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold">Select Media</h2>
        <Button
          onClick={handleNext}
          disabled={selectedFiles.length === 0}
          size="sm"
          className="font-semibold"
        >
          Next
        </Button>
      </div>

      {/* File Input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple={allowMultiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Area */}
      {selectedFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-4 p-12 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors"
          >
            <Upload className="w-16 h-16 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium mb-1">Select Photos or Videos</p>
              <p className="text-sm text-muted-foreground">
                {allowMultiple ? `Select up to ${maxFiles} files` : 'Select one file'}
              </p>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Selected Files Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                {file.type === 'image' ? (
                  <img src={file.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="relative w-full h-full">
                    <video src={file.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="w-8 h-8 text-white" />
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleRemove(index)}
                  className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5 hover:bg-black/70 transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute top-2 left-2 bg-primary rounded-full p-1">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              </div>
            ))}
          </div>

          {/* Add More Button */}
          {allowMultiple && selectedFiles.length < maxFiles && (
            <Button
              onClick={() => inputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Add More ({selectedFiles.length}/{maxFiles})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
