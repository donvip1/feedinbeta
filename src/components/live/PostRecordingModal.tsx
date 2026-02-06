import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Share2, Video, Mic2, 
  FileVideo, CheckCircle, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PostRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordingUrl: string;
  roomType: 'video_broadcast' | 'audio_space';
  title: string;
  hostName: string;
  hostAvatar: string;
  duration?: number;
  viewerCount?: number;
}

export const PostRecordingModal = ({
  isOpen,
  onClose,
  recordingUrl,
  roomType,
  title,
  hostName,
  hostAvatar,
  duration = 0,
  viewerCount = 0,
}: PostRecordingModalProps) => {
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [posted, setPosted] = useState(false);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const handleDownload = async () => {
    if (!recordingUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(recordingUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_recording.${roomType === 'audio_space' ? 'ogg' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download started!');
    } catch (error) {
      toast.error('Failed to download recording');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePostToFeed = async () => {
    if (!recordingUrl) return;
    
    setIsPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create a post with the recording
      const postData = {
        user_id: user.id,
        content: caption || `Check out my ${roomType === 'audio_space' ? 'audio space' : 'live stream'}: ${title}`,
        media_urls: [recordingUrl],
        media_types: [roomType === 'audio_space' ? 'audio' : 'video'],
        post_type: roomType === 'audio_space' ? 'audio' : 'video',
        metadata: {
          source: 'live_recording',
          original_title: title,
          duration,
          viewer_count: viewerCount,
        },
      };

      const { error } = await supabase.from('posts').insert(postData);

      if (error) throw error;

      setPosted(true);
      toast.success('Posted to your feed!');
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Post to feed error:', error);
      toast.error(error.message || 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              {roomType === 'audio_space' ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Mic2 className="w-5 h-5 text-emerald-500" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Video className="w-5 h-5 text-red-500" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-foreground">Recording Available</h3>
                <p className="text-xs text-muted-foreground">
                  {duration > 0 && `${formatDuration(duration)} • `}
                  {viewerCount} viewers
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Recording Preview */}
            <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <FileVideo className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">{title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={hostAvatar} />
                    <AvatarFallback>{hostName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{hostName}</span>
                </div>
              </div>
            </div>

            {/* Caption Input */}
            {!posted && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Add a caption (optional)
                </label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share your thoughts about this session..."
                  className="resize-none"
                  rows={3}
                />
              </div>
            )}

            {/* Success State */}
            {posted && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center py-6"
              >
                <CheckCircle className="w-16 h-16 text-emerald-500 mb-3" />
                <h4 className="font-semibold text-foreground">Posted to Feed!</h4>
                <p className="text-sm text-muted-foreground">Your recording is now live</p>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          {!posted && (
            <div className="p-4 border-t border-border space-y-2">
              <Button
                onClick={handlePostToFeed}
                disabled={isPosting}
                className="w-full"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Post to Feed
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Recording
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PostRecordingModal;
