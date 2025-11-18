import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Music, Palette, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MusicLibrary } from './MusicLibrary';

interface TextPostCreatorProps {
  open: boolean;
  onClose: () => void;
  onCreate: (textContent: string, textConfig: TextConfig, musicUrl?: string, voiceUrl?: string, postTarget?: 'feed' | 'story' | 'both') => void;
  isPremium?: boolean;
}

interface TextConfig {
  font: string;
  fontSize: number;
  backgroundColor: string | null;
}

const BACKGROUND_GRADIENTS = [
  { name: 'None', value: null, class: 'bg-background' },
  { name: 'Sunset', value: 'sunset', class: 'bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600' },
  { name: 'Ocean', value: 'ocean', class: 'bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-600' },
  { name: 'Forest', value: 'forest', class: 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600' },
  { name: 'Night', value: 'night', class: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900' },
  { name: 'Fire', value: 'fire', class: 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500' },
  { name: 'Purple', value: 'purple', class: 'bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500' },
  { name: 'Sky', value: 'sky', class: 'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600' },
];

const FONTS = [
  { name: 'Default', value: 'font-sans' },
  { name: 'Serif', value: 'font-serif' },
  { name: 'Bold', value: 'font-bold' },
  { name: 'Mono', value: 'font-mono' },
];

export function TextPostCreator({ open, onClose, onCreate, isPremium = false }: TextPostCreatorProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [selectedFont, setSelectedFont] = useState('font-sans');
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<{ url: string; title: string } | null>(null);
  const [postTarget, setPostTarget] = useState<'feed' | 'story' | 'both'>('feed');

  const maxChars = 700;
  const charCount = text.length;

  // Auto-adjust font size based on character count
  const calculateFontSize = () => {
    if (charCount < 50) return 48;
    if (charCount < 100) return 40;
    if (charCount < 200) return 32;
    if (charCount < 300) return 28;
    return 24;
  };

  const fontSize = calculateFontSize();

  const handleMusicSelect = (music: { name: string; artist: string; url: string; duration: number }) => {
    setSelectedMusic({ url: music.url, title: `${music.name} - ${music.artist}` });
    setShowMusicLibrary(false);
    toast({
      title: 'Music added',
      description: `${music.name} - Max 60 seconds`,
    });
  };

  const handlePost = () => {
    if (!text.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text',
        variant: 'destructive',
      });
      return;
    }

    onCreate(
      text,
      {
        font: selectedFont,
        fontSize,
        backgroundColor: selectedBackground,
      },
      selectedMusic?.url,
      undefined,
      postTarget
    );
  };

  const getCurrentBackgroundClass = () => {
    const bg = BACKGROUND_GRADIENTS.find(b => b.value === selectedBackground);
    return bg?.class || 'bg-background';
  };

  if (showMusicLibrary) {
    return (
      <MusicLibrary
        open={true}
        onClose={() => setShowMusicLibrary(false)}
        onSelectMusic={handleMusicSelect}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full md:max-w-2xl h-[100dvh] md:h-[90vh] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">Create Text Post</h2>
          <Button 
            onClick={handlePost}
            disabled={!text.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 font-semibold"
          >
            Post
          </Button>
        </div>

        {/* Text Preview */}
        <div className={`flex-1 relative overflow-hidden ${getCurrentBackgroundClass()}`}>
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxChars))}
              placeholder="Share your thoughts..."
              className={`w-full h-full text-center resize-none bg-transparent border-none focus:ring-0 text-white placeholder:text-white/50 ${selectedFont}`}
              style={{ fontSize: `${fontSize}px` }}
            />
          </div>

          {/* Character Count */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="text-sm font-medium">
              {charCount}/{maxChars}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="border-t border-border bg-background">
          {/* Post Target Selection */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-2">
              <Button
                variant={postTarget === 'feed' ? 'default' : 'outline'}
                onClick={() => setPostTarget('feed')}
                className="flex-1"
                size="sm"
              >
                Feed
              </Button>
              <Button
                variant={postTarget === 'story' ? 'default' : 'outline'}
                onClick={() => setPostTarget('story')}
                className="flex-1"
                size="sm"
              >
                Story
              </Button>
              <Button
                variant={postTarget === 'both' ? 'default' : 'outline'}
                onClick={() => setPostTarget('both')}
                className="flex-1"
                size="sm"
              >
                Both
              </Button>
            </div>
          </div>

          {/* Background Selection */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Background</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {BACKGROUND_GRADIENTS.map((bg) => (
                <button
                  key={bg.name}
                  onClick={() => setSelectedBackground(bg.value)}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                >
                  <div
                    className={`w-14 h-14 rounded-xl ${bg.class} border-2 transition-all ${
                      selectedBackground === bg.value
                        ? 'border-primary scale-95'
                        : 'border-border'
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">{bg.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Selection */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Font Style</span>
            </div>
            <div className="flex gap-2">
              {FONTS.map((font) => (
                <Button
                  key={font.name}
                  variant={selectedFont === font.value ? 'default' : 'outline'}
                  onClick={() => setSelectedFont(font.value)}
                  size="sm"
                  className={font.value}
                >
                  {font.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Add Music */}
          <div className="p-4">
            <Button
              variant="outline"
              onClick={() => setShowMusicLibrary(true)}
              className="w-full"
            >
              <Music className="w-4 h-4 mr-2" />
              {selectedMusic ? selectedMusic.title : 'Add Music'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
