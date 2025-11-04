import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Search, Play, Pause, TrendingUp, Clock, Heart, X, Upload, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchTrendingSongs, getAvailableContinents, checkCopyrightStatus, type TrendingSong } from '@/services/musicTrendingService';

interface MusicLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectMusic: (music: { name: string; artist: string; url: string; duration: number }) => void;
}

// Trending songs library (would connect to real API in production)
const TRENDING_SONGS = [
  { id: 1, name: 'Summer Vibes', artist: 'DJ Mix', genre: 'Electronic', duration: 45, url: 'https://example.com/music/summer.mp3' },
  { id: 2, name: 'Chill Beats', artist: 'Lo-Fi King', genre: 'Lo-Fi', duration: 60, url: 'https://example.com/music/chill.mp3' },
  { id: 3, name: 'Epic Moments', artist: 'Orchestra Pro', genre: 'Cinematic', duration: 50, url: 'https://example.com/music/epic.mp3' },
  { id: 4, name: 'Happy Day', artist: 'Sunny Smith', genre: 'Pop', duration: 55, url: 'https://example.com/music/happy.mp3' },
  { id: 5, name: 'Urban Flow', artist: 'Street Beats', genre: 'Hip Hop', duration: 48, url: 'https://example.com/music/urban.mp3' },
  { id: 6, name: 'Love Story', artist: 'Romance Band', genre: 'Romantic', duration: 52, url: 'https://example.com/music/love.mp3' },
  { id: 7, name: 'Energy Boost', artist: 'Workout Mix', genre: 'EDM', duration: 60, url: 'https://example.com/music/energy.mp3' },
  { id: 8, name: 'Nature Sounds', artist: 'Ambient Zen', genre: 'Ambient', duration: 60, url: 'https://example.com/music/nature.mp3' },
  { id: 9, name: 'Party Time', artist: 'Dance Master', genre: 'Dance', duration: 55, url: 'https://example.com/music/party.mp3' },
  { id: 10, name: 'Smooth Jazz', artist: 'Jazz Legends', genre: 'Jazz', duration: 58, url: 'https://example.com/music/jazz.mp3' },
];

const RECENT_SONGS = [
  { id: 11, name: 'Midnight Drive', artist: 'Night Rider', genre: 'Synthwave', duration: 47, url: 'https://example.com/music/midnight.mp3' },
  { id: 12, name: 'Beach Sunset', artist: 'Coastal Waves', genre: 'Acoustic', duration: 53, url: 'https://example.com/music/beach.mp3' },
];

const FAVORITE_SONGS = [
  { id: 13, name: 'My Favorite', artist: 'Best Artist', genre: 'Pop', duration: 50, url: 'https://example.com/music/favorite.mp3' },
];

export function MusicLibrary({ open, onClose, onSelectMusic }: MusicLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'upload'>('trending');
  const [selectedContinent, setSelectedContinent] = useState('worldwide');
  const [trendingSongs, setTrendingSongs] = useState<TrendingSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const continents = getAvailableContinents();

  // Load trending songs when continent changes
  useEffect(() => {
    if (open && activeTab === 'trending') {
      loadTrendingSongs();
    }
  }, [open, selectedContinent, activeTab]);

  const loadTrendingSongs = async () => {
    setLoading(true);
    try {
      const songs = await fetchTrendingSongs(selectedContinent);
      setTrendingSongs(songs);
    } catch (error) {
      toast({
        title: 'Error loading songs',
        description: 'Failed to fetch trending music',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSongs = trendingSongs.filter(
    (song) =>
      song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePlayPause = (songId: string, url: string) => {
    if (playingId === songId) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => {
        // Handle play error silently (demo URLs)
      });
      setPlayingId(songId);
      
      audioRef.current.onended = () => {
        setPlayingId(null);
      };
    }
  };

  const handleSelectSong = (song: TrendingSong) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onSelectMusic({
      name: song.name,
      artist: song.artist,
      url: song.url,
      duration: song.duration,
    });
    toast({
      title: 'Music added',
      description: `${song.name} by ${song.artist} - ${song.duration}s`,
    });
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an audio file',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Audio file must be under 10MB',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Check copyright status (silent in background)
      const copyrightCheck = await checkCopyrightStatus(file);
      
      if (!copyrightCheck.isSafe) {
        toast({
          title: 'Copyright issue detected',
          description: 'This audio cannot be used due to copyright restrictions',
          variant: 'destructive',
        });
        return;
      }

      // Create object URL for the audio file
      const audioUrl = URL.createObjectURL(file);
      
      // Get audio duration
      const audio = new Audio(audioUrl);
      audio.addEventListener('loadedmetadata', () => {
        const duration = Math.floor(audio.duration);
        
        if (duration > 60) {
          toast({
            title: 'Audio too long',
            description: 'Audio must be 60 seconds or less',
            variant: 'destructive',
          });
          URL.revokeObjectURL(audioUrl);
          return;
        }

        onSelectMusic({
          name: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Custom Audio',
          url: audioUrl,
          duration,
        });
        
        toast({
          title: 'Audio uploaded',
          description: `${file.name} (${duration}s)`,
        });
        onClose();
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to process audio file',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Music Library
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Max 60 seconds</p>
          </div>
          
          {/* Search Bar */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search songs, artists, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
          <TabsList className="mx-6 grid w-auto grid-cols-2 mt-2">
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="flex-1 mt-0">
            {/* Continent Selector */}
            <div className="px-6 py-3 border-b">
              <ScrollArea className="w-full">
                <div className="flex gap-2">
                  {continents.map((continent) => (
                    <Button
                      key={continent}
                      size="sm"
                      variant={selectedContinent === continent.toLowerCase() ? 'default' : 'outline'}
                      onClick={() => setSelectedContinent(continent.toLowerCase())}
                      className="whitespace-nowrap"
                    >
                      {continent}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <ScrollArea className="h-[50vh] px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Music className="w-12 h-12 mb-2 opacity-50" />
                  <p>No songs found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => togglePlayPause(song.id, song.url)}
                          className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform"
                        >
                          {playingId === song.id ? (
                            <Pause className="w-4 h-4 text-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white ml-0.5" />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{song.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.artist} • {song.genre} • {song.duration}s
                          </p>
                          {song.trending_rank && (
                            <p className="text-xs text-primary font-medium">
                              #{song.trending_rank} Trending
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleSelectSong(song)}
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload" className="flex-1 mt-0">
            <div className="px-6 py-8 flex flex-col items-center justify-center h-[60vh]">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-gradient-primary rounded-full flex items-center justify-center">
                  <Upload className="w-10 h-10 text-white" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Upload Your Music</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select an audio file from your device<br />
                    (Max 60 seconds, 10MB)
                  </p>
                </div>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="bg-gradient-primary"
                >
                  {loading ? 'Uploading...' : 'Choose Audio File'}
                </Button>

                <div className="text-xs text-muted-foreground mt-4 max-w-md">
                  <p className="font-medium mb-2">⚠️ Copyright Notice:</p>
                  <p>
                    We automatically check uploaded audio for copyright issues.
                    Copyrighted content will be rejected. Only use music you have
                    rights to or royalty-free tracks.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t bg-muted/20">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Music className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Trending songs are royalty-free. Artist attribution will be automatically added.
              Uploaded audio is checked for copyright compliance before use.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
