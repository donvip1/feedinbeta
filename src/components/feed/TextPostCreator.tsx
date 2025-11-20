import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstagramStylePostDetails } from './InstagramStylePostDetails';

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

const BACKGROUNDS = [
  { name: 'None', value: null, class: 'bg-background' },
  { name: 'Red', value: 'red', class: 'bg-red-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Yellow', value: 'yellow', class: 'bg-yellow-500' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Sunset', value: 'sunset', class: 'bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600' },
  { name: 'Ocean', value: 'ocean', class: 'bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-600' },
  { name: 'Forest', value: 'forest', class: 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600' },
  { name: 'Night', value: 'night', class: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900' },
  { name: 'Fire', value: 'fire', class: 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500' },
  { name: 'Rose', value: 'rose', class: 'bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500' },
  { name: 'Sky', value: 'sky', class: 'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600' },
  { name: 'Mint', value: 'mint', class: 'bg-gradient-to-br from-emerald-400 via-green-400 to-teal-500' },
];

export function TextPostCreator({ open, onClose, onCreate, isPremium = false }: TextPostCreatorProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [showPostDetails, setShowPostDetails] = useState(false);
  const [textMediaUrl, setTextMediaUrl] = useState('');

  const maxChars = 700;
  const charCount = text.length;

  // Auto-adjust font size based on character count
  const calculateFontSize = () => {
    if (charCount < 50) return 56;
    if (charCount < 100) return 48;
    if (charCount < 200) return 40;
    if (charCount < 300) return 32;
    if (charCount < 400) return 28;
    return 24;
  };

  const fontSize = calculateFontSize();

  const getCurrentBackgroundClass = () => {
    const bg = BACKGROUNDS.find(b => b.value === selectedBackground);
    return bg?.class || 'bg-background';
  };

  const handleNext = () => {
    if (!text.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text',
        variant: 'destructive',
      });
      return;
    }

    // Store text and config for post details
    setTextMediaUrl(text);
    setShowPostDetails(true);
  };

  if (showPostDetails) {
    return (
      <InstagramStylePostDetails
        open={true}
        onClose={onClose}
        onBack={() => setShowPostDetails(false)}
        mediaUrl={textMediaUrl}
        mediaType="text"
        effects={{
          backgroundColor: selectedBackground,
          fontSize,
        }}
        mediaFile={null}
        quotePost={null}
        onSuccess={() => {
          setText('');
          setSelectedBackground(null);
          onClose();
        }}
      />
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Create Text Post</h2>
        <Button 
          onClick={handleNext}
          disabled={!text.trim()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Check className="w-5 h-5" />
        </Button>
      </div>

      {/* Text Preview - Full Screen */}
      <div className={`flex-1 relative overflow-hidden ${getCurrentBackgroundClass()} flex items-center justify-center p-4`}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          placeholder="Share your thoughts..."
          className="w-full max-w-2xl h-full min-h-[60vh] text-center resize-none bg-transparent border-none focus:ring-0 text-white placeholder:text-white/50 font-sans"
          style={{ fontSize: `${fontSize}px`, lineHeight: '1.3' }}
        />

        {/* Character Count */}
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="text-sm font-medium text-white">
            {charCount}/{maxChars}
          </span>
        </div>
      </div>

      {/* Background Selection - Scrollable */}
      <div className="bg-background border-t border-border p-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.name}
              onClick={() => setSelectedBackground(bg.value)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div
                className={`w-16 h-16 rounded-xl ${bg.class} border-2 transition-all ${
                  selectedBackground === bg.value
                    ? 'border-primary scale-95 ring-2 ring-primary/50'
                    : 'border-border'
                }`}
              />
              <span className="text-xs text-muted-foreground">{bg.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
