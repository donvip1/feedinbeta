import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Music, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIMusicSuggesterProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onSuggestionAccept: (musicUrl: string) => void;
  onDismiss: () => void;
}

// Free, royalty-free music suggestions based on content type
const MUSIC_LIBRARY = {
  nature: { name: 'Peaceful Nature', url: 'https://example.com/music/nature.mp3' },
  urban: { name: 'City Vibes', url: 'https://example.com/music/urban.mp3' },
  happy: { name: 'Upbeat Day', url: 'https://example.com/music/happy.mp3' },
  chill: { name: 'Chill Beats', url: 'https://example.com/music/chill.mp3' },
  energetic: { name: 'High Energy', url: 'https://example.com/music/energetic.mp3' },
  romantic: { name: 'Love Story', url: 'https://example.com/music/romantic.mp3' },
  dramatic: { name: 'Epic Moments', url: 'https://example.com/music/dramatic.mp3' },
};

export function AIMusicSuggester({ mediaUrl, mediaType, onSuggestionAccept, onDismiss }: AIMusicSuggesterProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<{ name: string; url: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const analyzeMoodAndSuggest = useCallback(async () => {
    setLoading(true);
    try {
      // Call AI to analyze the image/video mood
      const { data, error } = await supabase.functions.invoke('analyze-media-mood', {
        body: { mediaUrl, mediaType },
      });

      if (error) throw error;

      const mood = data?.mood || 'chill';
      const suggestedMusic = MUSIC_LIBRARY[mood as keyof typeof MUSIC_LIBRARY] || MUSIC_LIBRARY.chill;
      
      setSuggestion(suggestedMusic);
    } catch (error) {
      console.error('Music suggestion error:', error);
      // Fallback to a default suggestion
      setSuggestion(MUSIC_LIBRARY.chill);
    } finally {
      setLoading(false);
    }
  }, [mediaUrl, mediaType]);

  useEffect(() => {
    analyzeMoodAndSuggest();
  }, [analyzeMoodAndSuggest]);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  if (dismissed || !suggestion) return null;

  return (
    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-3">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Finding perfect music...</span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-primary p-2 rounded-full">
              <Music className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">AI Suggested</p>
              <p className="text-xs text-muted-foreground">{suggestion.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onSuggestionAccept(suggestion.url)}
            >
              Use This
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleDismiss}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
