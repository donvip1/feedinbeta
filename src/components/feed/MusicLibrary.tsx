import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Search, Play, Pause, TrendingUp, Clock, Heart, X, Upload, Folder } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MusicLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectMusic: (music: { name: string; artist: string; url: string; duration: number }) => void;
}

// Royalty-free music library from Pixabay
const TRENDING_SONGS = [
  { id: 1, name: 'Summer Vibes', artist: 'Coma-Media', genre: 'Electronic', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 2, name: 'Chill Beats', artist: 'Chillmore', genre: 'Lo-Fi', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8a3bad6b7.mp3' },
  { id: 3, name: 'Epic Moments', artist: 'Grand_Project', genre: 'Cinematic', duration: 60, url: 'https://cdn.pixabay.com/audio/2024/07/30/audio_13baf4d6b0.mp3' },
  { id: 4, name: 'Happy Day', artist: 'Olexy', genre: 'Pop', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/03/22/audio_1327e1c18d.mp3' },
  { id: 5, name: 'Urban Flow', artist: 'RKVC', genre: 'Hip Hop', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_4a588b1e41.mp3' },
  { id: 6, name: 'Love Story', artist: 'Ashot-Danielyan', genre: 'Romantic', duration: 60, url: 'https://cdn.pixabay.com/audio/2023/10/30/audio_ea1f8fa8b0.mp3' },
  { id: 7, name: 'Energy Boost', artist: 'FASSounds', genre: 'EDM', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_c8c528c3e0.mp3' },
  { id: 8, name: 'Nature Sounds', artist: 'Lexin_Music', genre: 'Ambient', duration: 60, url: 'https://cdn.pixabay.com/audio/2023/08/30/audio_e68b21bf19.mp3' },
  { id: 9, name: 'Party Time', artist: 'SoundGalleryBy', genre: 'Dance', duration: 60, url: 'https://cdn.pixabay.com/audio/2023/11/08/audio_e8ffb7a32f.mp3' },
  { id: 10, name: 'Smooth Jazz', artist: 'Lesfm', genre: 'Jazz', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/11/22/audio_1e5d941b26.mp3' },
];

const RECENT_SONGS = [
  { id: 11, name: 'Midnight Drive', artist: 'Lux-Inspira', genre: 'Synthwave', duration: 60, url: 'https://cdn.pixabay.com/audio/2024/03/18/audio_f6ae8441fb.mp3' },
  { id: 12, name: 'Beach Sunset', artist: 'Zakhar_Valaha', genre: 'Acoustic', duration: 60, url: 'https://cdn.pixabay.com/audio/2022/09/07/audio_e87eb6c28b.mp3' },
];

const FAVORITE_SONGS = [
  { id: 13, name: 'Inspiring Dreams', artist: 'penguinmusic', genre: 'Inspirational', duration: 60, url: 'https://cdn.pixabay.com/audio/2023/12/27/audio_d32ef65f69.mp3' },
];

export function MusicLibrary({ open, onClose, onSelectMusic }: MusicLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'recent' | 'favorites'>('trending');
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getSongList = () => {
    switch (activeTab) {
      case 'trending':
        return TRENDING_SONGS;
      case 'recent':
        return RECENT_SONGS;
      case 'favorites':
        return FAVORITE_SONGS;
      default:
        return TRENDING_SONGS;
    }
  };

  const filteredSongs = getSongList().filter(
    (song) =>
      song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePlayPause = (songId: number, url: string) => {
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

  const handleSelectSong = (song: typeof TRENDING_SONGS[0]) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
    onSelectMusic({
      name: song.name,
      artist: song.artist,
      url: song.url,
      duration: song.duration,
    });
    toast({ title: 'Music added', description: `${song.name} by ${song.artist}` });
    onClose();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Error', description: 'Please select an audio file', variant: 'destructive' });
      return;
    }

    // Create object URL for the uploaded audio
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    
    audio.onloadedmetadata = () => {
      onSelectMusic({
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        artist: 'My Upload',
        url: url,
        duration: Math.round(audio.duration),
      });
      toast({ title: 'Music added', description: `${file.name} uploaded successfully` });
      onClose();
    };

    audio.onerror = () => {
      toast({ title: 'Error', description: 'Failed to load audio file', variant: 'destructive' });
    };
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
          
          {/* Upload Button */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload from Device
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
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
          <TabsList className="mx-6 grid w-auto grid-cols-3 mt-2">
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Favorites
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 mt-0">
            <ScrollArea className="h-[50vh] px-6 py-4">
              {filteredSongs.length === 0 ? (
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
        </Tabs>

        <div className="px-6 py-4 border-t bg-muted/20">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Music className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              All songs are royalty-free. Artist attribution will be automatically added to your post.
              Songs are limited to 60 seconds for posts.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
