import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Music, Upload, Play, Pause, TrendingUp, Loader2, Disc3, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { MusicTrimmer } from './MusicTrimmer';

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  duration_seconds: number | null;
  genre: string | null;
  is_trending: boolean | null;
  cover_image_url: string | null;
  source?: string | null;
  original_creator_id?: string | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface MusicPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack, trimStart?: number, trimEnd?: number) => void;
  onUpload: () => void;
}

export const MusicPicker: React.FC<MusicPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  onUpload,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [originalSounds, setOriginalSounds] = useState<MusicTrack[]>([]);
  const [userTracks, setUserTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTracks();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen]);

  const fetchTracks = async () => {
    setLoading(true);
    try {
      // Fetch system tracks
      const { data: systemTracks, error: systemError } = await supabase
        .from('music_tracks' as any)
        .select('*')
        .or('source.is.null,source.neq.original_audio')
        .order('is_trending', { ascending: false })
        .order('play_count', { ascending: false })
        .limit(50);

      if (systemError) throw systemError;
      setTracks((systemTracks as unknown as MusicTrack[]) || []);

      // Fetch original sounds with creator info
      const { data: originals, error: originalsError } = await supabase
        .from('music_tracks' as any)
        .select(`
          *,
          profiles:original_creator_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('source', 'original_audio')
        .order('usage_count', { ascending: false })
        .limit(30);

      if (!originalsError) {
        setOriginalSounds((originals as unknown as MusicTrack[]) || []);
      }

      // Fetch user's uploaded tracks
      if (user) {
        const { data: userUploadedTracks, error: userError } = await supabase
          .from('music_tracks' as any)
          .select('*')
          .eq('uploader_id', user.id)
          .order('created_at', { ascending: false });

        if (!userError) {
          setUserTracks((userUploadedTracks as unknown as MusicTrack[]) || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTracks = tracks.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.genre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOriginals = originalSounds.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trendingTracks = filteredTracks.filter(t => t.is_trending);

  const togglePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(track.audio_url);
      audioRef.current.play().catch(console.error);
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(track.id);
    }
  };

  const handleSelectTrack = (track: MusicTrack) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setSelectedTrack(track);
    setShowTrimmer(true);
  };

  const handleTrimConfirm = (track: MusicTrack, trimStart: number, trimEnd: number) => {
    onSelect(track, trimStart, trimEnd);
    setShowTrimmer(false);
    setSelectedTrack(null);
    onClose();
  };

  const handleQuickSelect = (track: MusicTrack) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onSelect(track, 0, track.duration_seconds || 30);
    onClose();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const TrackItem = ({ track, showCreator = false }: { track: MusicTrack; showCreator?: boolean }) => (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
        playingId === track.id && "bg-primary/10"
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlay(track);
        }}
        className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"
      >
        {playingId === track.id ? (
          <Pause className="w-4 h-4 text-primary" />
        ) : (
          <Play className="w-4 h-4 text-primary ml-0.5" />
        )}
      </button>
      
      <div className="flex-1 min-w-0" onClick={() => handleSelectTrack(track)}>
        <p className="font-medium truncate text-foreground">{track.title}</p>
        {showCreator && track.profiles ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Avatar className="w-4 h-4">
              <AvatarImage src={track.profiles.avatar_url || ''} />
              <AvatarFallback className="text-[8px]">{track.profiles.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground truncate">
              @{track.profiles.username}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground truncate">
            {track.artist || 'Unknown Artist'} • {formatDuration(track.duration_seconds)}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {track.is_trending && (
          <TrendingUp className="w-4 h-4 text-orange-500 flex-shrink-0" />
        )}
        <Button 
          size="sm" 
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleQuickSelect(track);
          }}
          className="text-xs"
        >
          Use
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen && !showTrimmer} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col z-[200]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Add Music
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search music..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs defaultValue="trending" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="trending">
                <TrendingUp className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="originals">
                <Volume2 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="my">My</TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="trending" className="m-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : trendingTracks.length > 0 ? (
                  <div className="space-y-1">
                    {trendingTracks.map(track => (
                      <TrackItem key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No trending tracks found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all" className="m-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTracks.length > 0 ? (
                  <div className="space-y-1">
                    {filteredTracks.map(track => (
                      <TrackItem key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No tracks found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="originals" className="m-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredOriginals.length > 0 ? (
                  <div className="space-y-1">
                    {filteredOriginals.map(track => (
                      <TrackItem key={track.id} track={track} showCreator />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Disc3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No original sounds yet</p>
                    <p className="text-xs mt-1">Sounds from video posts will appear here</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="my" className="m-0">
                {userTracks.length > 0 ? (
                  <div className="space-y-1">
                    {userTracks.map(track => (
                      <TrackItem key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No uploaded music yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={onUpload}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Music
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upload" className="m-0">
                <div className="text-center py-8">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Upload Your Music</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your own audio files to use in posts
                  </p>
                  <Button onClick={onUpload}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Music Trimmer Modal */}
      <MusicTrimmer
        isOpen={showTrimmer}
        onClose={() => {
          setShowTrimmer(false);
          setSelectedTrack(null);
        }}
        track={selectedTrack}
        onConfirm={handleTrimConfirm}
      />
    </>
  );
};
