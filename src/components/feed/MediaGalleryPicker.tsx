import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MediaGalleryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: File[]) => void;
  multiSelect?: boolean;
}

export function MediaGalleryPicker({
  open,
  onClose,
  onSelect,
  multiSelect = true,
}: MediaGalleryPickerProps) {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string; type: 'image' | 'video' }[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'videos' | 'photos'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMultiSelect, setIsMultiSelect] = useState(multiSelect);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
    }));

    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const toggleFileSelection = (file: File) => {
    if (isMultiSelect) {
      setSelectedFiles((prev) => {
        const newSelection = prev.includes(file) 
          ? prev.filter((f) => f !== file) 
          : [...prev, file];
        
        // Limit to 10 images for carousel
        if (newSelection.length > 10) {
          toast({
            title: 'Maximum 10 images',
            description: 'You can select up to 10 images for a carousel post',
            variant: 'destructive',
          });
          return prev;
        }
        return newSelection;
      });
    } else {
      setSelectedFiles([file]);
    }
  };

  const handleNext = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'No media selected',
        description: 'Please select at least one media file',
        variant: 'destructive',
      });
      return;
    }
    onSelect(selectedFiles);
    onClose();
  };

  const filteredPreviews = previews.filter((preview) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'videos') return preview.type === 'video';
    if (activeTab === 'photos') return preview.type === 'image';
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Select Media</DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
          </div>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-y-auto mt-4">
            {filteredPreviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p>No media files yet</p>
                <Button
                  variant="link"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2"
                >
                  Click to browse files
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredPreviews.map((preview, index) => {
                  const isSelected = selectedFiles.includes(preview.file);
                  return (
                    <button
                      key={index}
                      onClick={() => toggleFileSelection(preview.file)}
                      className="relative aspect-square rounded-lg overflow-hidden group"
                    >
                      {preview.type === 'video' ? (
                        <>
                          <video
                            src={preview.url}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            VIDEO
                          </div>
                        </>
                      ) : (
                        <img
                          src={preview.url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-primary" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <div
                          className={`w-6 h-6 rounded-full border-2 ${
                            isSelected ? 'bg-primary border-primary' : 'bg-white/50 border-white'
                          } flex items-center justify-center`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-multiple"
                className="w-4 h-4"
                checked={isMultiSelect}
                onChange={(e) => {
                  setIsMultiSelect(e.target.checked);
                  if (!e.target.checked && selectedFiles.length > 1) {
                    setSelectedFiles([selectedFiles[0]]);
                  }
                }}
              />
              <label htmlFor="select-multiple" className="text-sm">
                Multi-select
              </label>
            </div>
            {selectedFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} selected {isMultiSelect && '(max 10)'}
              </p>
            )}
          </div>
          <Button
            onClick={handleNext}
            disabled={selectedFiles.length === 0}
            className="ml-auto bg-gradient-primary"
          >
            Next {selectedFiles.length > 1 && `(${selectedFiles.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
