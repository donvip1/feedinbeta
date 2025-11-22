import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Music } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateStoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Sample music library (in production, this would come from an API)
const musicLibrary = [
  { id: '1', title: 'Summer Vibes', artist: 'DJ Flow', url: '/music/sample1.mp3' },
  { id: '2', title: 'Chill Beats', artist: 'Lo-Fi Master', url: '/music/sample2.mp3' },
  { id: '3', title: 'Upbeat Energy', artist: 'Pop Stars', url: '/music/sample3.mp3' },
  { id: '4', title: 'Relaxing Melody', artist: 'Ambient Sounds', url: '/music/sample4.mp3' },
];

interface CreateStoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateStoryModal = ({ open, onClose, onSuccess }: CreateStoryModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { progress, isUploading, startUpload, updateProgress, completeUpload, failUpload } = useUploadProgress();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image or video file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!user || !file) return;

    setUploading(true);
    startUpload();
    try {
      updateProgress(10);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const storageBucket = file.type.startsWith('video/') ? 'post-videos' : 'posts';

      updateProgress(30);
      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      updateProgress(60);
      const { data: { publicUrl } } = supabase.storage
        .from(storageBucket)
        .getPublicUrl(fileName);

      updateProgress(80);
      const isImage = file.type.startsWith('image/');
      const music = isImage && selectedMusic && selectedMusic !== 'none' ? musicLibrary.find(m => m.id === selectedMusic) : null;
      
      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: isImage ? 'image' : 'video',
        music_url: music?.url || null,
        music_title: music?.title || null,
        music_artist: music?.artist || null,
      });

      if (insertError) throw insertError;

      updateProgress(95);
      toast({
        title: 'Story created',
        description: 'Your story has been shared',
      });

      completeUpload();
      onSuccess();
      setFile(null);
      setPreview(null);
      setSelectedMusic(null);
    } catch (error: any) {
      failUpload(error.message);
      toast({
        title: 'Error creating story',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setPreview(null);
      setSelectedMusic(null);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-background border-border max-w-md max-h-[85vh] overflow-y-auto my-8">
          <DialogHeader>
            <DialogTitle>Create Story</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!preview ? (
              <div>
                <Label htmlFor="story-file" className="cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to upload image or video
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Story will expire in 24 hours
                    </p>
                  </div>
                </Label>
                <Input
                  id="story-file"
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setSelectedMusic(null);
                  }}
                  className="absolute top-2 right-2 z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
                  disabled={uploading}
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="relative aspect-[9/16] max-h-[500px] rounded-lg overflow-hidden bg-black">
                  {file?.type.startsWith('image/') ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <video src={preview} controls className="w-full h-full object-contain" />
                  )}
                </div>
                
                {/* Music selection for images */}
                {file?.type.startsWith('image/') && (
                  <div className="mt-4">
                    <Label htmlFor="music" className="flex items-center gap-2 mb-2">
                      <Music className="w-4 h-4" />
                      <span>Add Music (Optional)</span>
                    </Label>
                    <Select value={selectedMusic || 'none'} onValueChange={setSelectedMusic}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a song" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No music</SelectItem>
                        {musicLibrary.map((music) => (
                          <SelectItem key={music.id} value={music.id}>
                            {music.title} - {music.artist}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {preview && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-gradient-to-r from-pink-500 to-blue-500"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Share Story'
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <ProgressBar progress={progress} isVisible={isUploading} label="Uploading Story" />
    </>
  );
};
