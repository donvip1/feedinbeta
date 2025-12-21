import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Music, TrendingUp, Disc3, Upload, Play, Pause, Plus, User, Loader2, Volume2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MusicUploader } from '@/components/post/MusicUploader';

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  duration_seconds: number | null;
  genre: string | null;
  is_trending: boolean | null;
  cover_image_url: string | null;
  play_count: number | null;
  usage_count: number | null;
  source: string | null;
  original_post_id: string | null;
  original_creator_id: string | null;
  uploader_id: string | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 
  'Country', 'Reggae', 'Latin', 'Afrobeat', 'K-Pop', 'Indie', 'Metal',
  'Blues', 'Soul', 'Funk', 'Disco', 'House', 'Techno', 'Ambient'
];

export default function MusicDiscovery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [originalSounds, setOriginalSounds] = useState<MusicTrack[]>([]);
  const [userTracks, setUserTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchAllMusic();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [user]);

  const fetchAllMusic = async () => {
    setLoading(true);
    try {
      // Fetch all system/library tracks
      const { data: libraryTracks, error: libraryError } = await supabase
        .from('music_tracks')
        .select('*')
        .or('source.is.null,source.neq.original_audio')
        .order('is_trending', { ascending: false })
        .order('play_count', { ascending: false })
        .limit(100);

      if (libraryError) throw libraryError;
      setTracks((libraryTracks as unknown as MusicTrack[]) || []);

      // Fetch original sounds (from video posts)
      const { data: originals, error: originalsError } = await supabase
        .from('music_tracks')
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
        .limit(50);

      if (!originalsError) {
        setOriginalSounds((originals as unknown as MusicTrack[]) || []);
      }

      // Fetch user's uploaded tracks
      if (user) {
        const { data: myTracks, error: myError } = await supabase
          .from('music_tracks')
          .select('*')
          .eq('uploader_id', user.id)
          .order('created_at', { ascending: false });

        if (!myError) {
          setUserTracks((myTracks as unknown as MusicTrack[]) || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch music:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = !searchQuery || 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = !selectedGenre || track.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const trendingTracks = filteredTracks.filter(t => t.is_trending).slice(0, 10);

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

      // Increment play count
      supabase
        .from('music_tracks')
        .update({ play_count: (track.play_count || 0) + 1 })
        .eq('id', track.id)
        .then(() => {});
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUploadComplete = () => {
    setShowUploader(false);
    fetchAllMusic();
    toast({
      title: 'Music uploaded',
      description: 'Your track is now available in your library',
    });
  };

  const TrackCard = ({ track, showCreator = false }: { track: MusicTrack; showCreator?: boolean }) => (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-all group",
        playingId === track.id && "bg-primary/10 border border-primary/20"
      )}
      onClick={() => togglePlay(track)}
    >
      <div className="relative">
        <div className={cn(
          "w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center",
          playingId === track.id && "animate-pulse"
        )}>
          {track.cover_image_url ? (
            <img src={track.cover_image_url} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Music className="w-5 h-5 text-primary" />
          )}
        </div>
        <button className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
          {playingId === track.id ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
      </div>
      
      <div className="flex-1 min-w-0">
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
          <TrendingUp className="w-4 h-4 text-orange-500" />
        )}
        {(track.usage_count || 0) > 0 && (
          <span className="text-xs text-muted-foreground">{track.usage_count} posts</span>
        )}
      </div>
    </div>
  );

  const HorizontalTrackCard = ({ track }: { track: MusicTrack }) => (
    <div
      className={cn(
        "flex-shrink-0 w-32 p-3 rounded-xl bg-card border border-border cursor-pointer transition-all hover:border-primary/50",
        playingId === track.id && "border-primary bg-primary/5"
      )}
      onClick={() => togglePlay(track)}
    >
      <div className={cn(
        "w-full aspect-square rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center mb-2 relative group",
        playingId === track.id && "animate-pulse"
      )}>
        {track.cover_image_url ? (
          <img src={track.cover_image_url} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <Disc3 className={cn("w-8 h-8 text-primary", playingId === track.id && "animate-spin")} />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
          {playingId === track.id ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-0.5" />
          )}
        </div>
      </div>
      <p className="font-medium text-sm truncate">{track.title}</p>
      <p className="text-xs text-muted-foreground truncate">{track.artist || 'Unknown'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              Music Discovery
            </h1>
          </div>
          <Button size="sm" onClick={() => setShowUploader(true)}>
            <Upload className="w-4 h-4 mr-1" />
            Upload
          </Button>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search music, artists, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {/* Trending Section */}
          {trendingTracks.length > 0 && !searchQuery && !selectedGenre && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Trending Now
              </h2>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3">
                  {trendingTracks.map(track => (
                    <HorizontalTrackCard key={track.id} track={track} />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Genre Chips */}
          <section>
            <h2 className="text-lg font-semibold mb-3">Browse by Genre</h2>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2">
                <Badge
                  variant={selectedGenre === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedGenre(null)}
                >
                  All
                </Badge>
                {GENRES.map(genre => (
                  <Badge
                    key={genre}
                    variant={selectedGenre === genre ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedGenre(genre === selectedGenre ? null : genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="all">All Music</TabsTrigger>
              <TabsTrigger value="originals">
                <Volume2 className="w-4 h-4 mr-1" />
                Original Sounds
              </TabsTrigger>
              <TabsTrigger value="my">My Music</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {filteredTracks.length > 0 ? (
                <div className="space-y-1">
                  {filteredTracks.map(track => (
                    <TrackCard key={track.id} track={track} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tracks found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="originals" className="mt-4">
              {originalSounds.length > 0 ? (
                <div className="space-y-1">
                  {originalSounds.map(track => (
                    <TrackCard key={track.id} track={track} showCreator />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No original sounds yet</p>
                  <p className="text-sm mt-1">Post videos to create original sounds</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="my" className="mt-4">
              {userTracks.length > 0 ? (
                <div className="space-y-1">
                  {userTracks.map(track => (
                    <TrackCard key={track.id} track={track} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No uploaded music yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowUploader(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Your First Track
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Music Uploader Modal */}
      <MusicUploader
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}