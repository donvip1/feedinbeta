import React, { useState } from 'react';
import { Disc3, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UseOriginalAudioButtonProps {
  postId: string;
  postUserId: string;
  mediaUrl: string;
  creatorUsername: string;
  creatorDisplayName: string;
  onSoundCreated?: (trackId: string) => void;
  className?: string;
  variant?: 'default' | 'minimal';
}

export const UseOriginalAudioButton: React.FC<UseOriginalAudioButtonProps> = ({
  postId,
  postUserId,
  mediaUrl,
  creatorUsername,
  creatorDisplayName,
  onSoundCreated,
  className = '',
  variant = 'default',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreateSound = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to use this sound',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Check if original audio track already exists for this post
      const { data: existing } = await supabase
        .from('music_tracks')
        .select('id')
        .eq('original_post_id', postId)
        .single();

      if (existing) {
        toast({
          title: 'Sound already saved',
          description: 'This original sound is already in the library',
        });
        setCreated(true);
        onSoundCreated?.(existing.id);
        return;
      }

      // Create new original audio track
      const { data: newTrack, error } = await supabase
        .from('music_tracks')
        .insert({
          title: `Original Sound - @${creatorUsername}`,
          artist: creatorDisplayName,
          audio_url: mediaUrl,
          source: 'original_audio',
          original_post_id: postId,
          original_creator_id: postUserId,
          uploader_id: postUserId,
          usage_count: 1,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update the post to link to this track
      await supabase
        .from('posts')
        .update({ original_audio_track_id: newTrack.id })
        .eq('id', postId);

      setCreated(true);
      toast({
        title: 'Sound saved',
        description: 'Original sound added to the library',
      });
      onSoundCreated?.(newTrack.id);
    } catch (error) {
      console.error('Error creating original sound:', error);
      toast({
        title: 'Error',
        description: 'Failed to save original sound',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleCreateSound}
        disabled={loading || created}
        className={`flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : created ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Disc3 className="w-3 h-3" />
        )}
        <span>{created ? 'Saved' : 'Use this sound'}</span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCreateSound}
      disabled={loading || created}
      className={className}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : created ? (
        <Check className="w-4 h-4 mr-1.5 text-green-500" />
      ) : (
        <Disc3 className="w-4 h-4 mr-1.5" />
      )}
      {created ? 'Sound Saved' : 'Use this sound'}
    </Button>
  );
};