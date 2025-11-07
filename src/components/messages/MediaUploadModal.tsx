import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { X, Image as ImageIcon, Video, Music, FileText, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ImageEditor } from './ImageEditor';
import { AudioTrimmer } from './AudioTrimmer';
import { VideoTrimmer } from './VideoTrimmer';

interface MediaUploadModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  onUploadComplete: () => void;
}

const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45MB

const getFileBucket = (type: string): string => {
  if (type.startsWith('image/')) return 'chat-images';
  if (type.startsWith('video/')) return 'chat-videos';
  if (type.startsWith('audio/')) return 'chat-audio';
  return 'chat-documents';
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
  if (type.startsWith('video/')) return <Video className="w-8 h-8" />;
  if (type.startsWith('audio/')) return <Music className="w-8 h-8" />;
  return <FileText className="w-8 h-8" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export const MediaUploadModal = ({ open, onClose, conversationId, onUploadComplete }: MediaUploadModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showAudioTrimmer, setShowAudioTrimmer] = useState(false);
  const [showVideoTrimmer, setShowVideoTrimmer] = useState(false);
  const [editedFile, setEditedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setEditedFile(null);

    // Auto-open editor/trimmer for supported types
    if (file.type.startsWith('image/')) {
      setShowImageEditor(true);
    } else if (file.type.startsWith('audio/')) {
      setShowAudioTrimmer(true);
    } else if (file.type.startsWith('video/')) {
      setShowVideoTrimmer(true);
    }
  };

  const handleImageEdit = (blob: Blob) => {
    const editedImageFile = new File([blob], selectedFile?.name || 'edited.jpg', {
      type: 'image/jpeg',
    });
    setEditedFile(editedImageFile);
    setShowImageEditor(false);
  };

  const handleAudioTrim = (blob: Blob) => {
    const trimmedAudioFile = new File([blob], selectedFile?.name || 'trimmed.mp3', {
      type: selectedFile?.type || 'audio/mpeg',
    });
    setEditedFile(trimmedAudioFile);
    setShowAudioTrimmer(false);
  };

  const handleVideoTrim = (blob: Blob) => {
    const trimmedVideoFile = new File([blob], selectedFile?.name || 'trimmed.mp4', {
      type: selectedFile?.type || 'video/mp4',
    });
    setEditedFile(trimmedVideoFile);
    setShowVideoTrimmer(false);
  };

  const handleUpload = async () => {
    const fileToUpload = editedFile || selectedFile;
    if (!fileToUpload) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const bucket = getFileBucket(fileToUpload.type);
      const fileName = `${user.id}/${Date.now()}-${fileToUpload.name}`;

      // Simulate upload progress (Supabase doesn't provide native progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, fileToUpload);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      // Create message with media
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: caption || 'Sent a file',
          media_url: publicUrl,
          media_type: fileToUpload.type,
        });

      if (messageError) throw messageError;

      toast({ title: 'File sent successfully' });
      onUploadComplete();
      handleClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setEditedFile(null);
    setCaption('');
    setUploadProgress(0);
    setIsUploading(false);
    onClose();
  };

  const fileToDisplay = editedFile || selectedFile;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Media</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!selectedFile ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="media-upload"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html,.css,.js,.json,.xml,.csv"
                />
                <label
                  htmlFor="media-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <FileText className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to select a file</p>
                  <p className="text-xs text-muted-foreground">
                    Max {formatFileSize(MAX_FILE_SIZE)}
                  </p>
                </label>
              </div>
            ) : (
              <>
                {/* File preview */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-3 bg-accent rounded-lg">
                      {getFileIcon(fileToDisplay?.type || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{fileToDisplay?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(fileToDisplay?.size || 0)}
                      </p>
                      {editedFile && (
                        <p className="text-xs text-primary mt-1">✓ Edited</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedFile(null)}
                      disabled={isUploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Edit buttons */}
                  {selectedFile && !isUploading && (
                    <div className="mt-4 flex gap-2">
                      {selectedFile.type.startsWith('image/') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowImageEditor(true)}
                        >
                          Edit Image
                        </Button>
                      )}
                      {selectedFile.type.startsWith('audio/') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAudioTrimmer(true)}
                        >
                          Trim Audio
                        </Button>
                      )}
                      {selectedFile.type.startsWith('video/') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowVideoTrimmer(true)}
                        >
                          Trim Video
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Caption */}
                <div>
                  <Textarea
                    placeholder="Add a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={isUploading}
                    rows={3}
                  />
                </div>

                {/* Upload progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editors */}
      {selectedFile && showImageEditor && (
        <ImageEditor
          open={showImageEditor}
          onClose={() => setShowImageEditor(false)}
          imageFile={selectedFile}
          onSave={handleImageEdit}
        />
      )}

      {selectedFile && showAudioTrimmer && (
        <AudioTrimmer
          open={showAudioTrimmer}
          onClose={() => setShowAudioTrimmer(false)}
          audioFile={selectedFile}
          onSave={handleAudioTrim}
        />
      )}

      {selectedFile && showVideoTrimmer && (
        <VideoTrimmer
          open={showVideoTrimmer}
          onClose={() => setShowVideoTrimmer(false)}
          videoFile={selectedFile}
          onSave={handleVideoTrim}
        />
      )}
    </>
  );
};
