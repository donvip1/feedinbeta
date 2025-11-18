import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Music, Volume2, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MusicLibrary } from './MusicLibrary';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const FONTS = [
  { name: 'Default', value: 'font-sans' },
  { name: 'Serif', value: 'font-serif' },
  { name: 'Mono', value: 'font-mono' },
  { name: 'Cursive', value: 'font-cursive' },
  { name: 'Bold', value: 'font-bold' },
  { name: 'Light', value: 'font-light' },
];

const BACKGROUND_COLORS = [
  { name: 'None', value: null },
  { name: 'Black', value: '#000000' },
  { name: 'Navy', value: '#1e3a8a' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Green', value: '#16a34a' },
];

const VOICE_TEMPLATES = [
  { id: 'alloy', name: 'Professional', description: 'Clear and professional tone' },
  { id: 'echo', name: 'Marketing', description: 'Engaging marketing voice' },
  { id: 'fable', name: 'Storyteller', description: 'Warm storytelling voice' },
  { id: 'onyx', name: 'Deep', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Friendly', description: 'Friendly and approachable' },
  { id: 'shimmer', name: 'Light', description: 'Light and energetic' },
  { id: 'sage', name: 'Strong', description: 'Strong and confident' },
  { id: 'breeze', name: 'Advert', description: 'Perfect for advertisements' },
];

export function TextPostCreator({ open, onClose, onCreate, isPremium = false }: TextPostCreatorProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [selectedFont, setSelectedFont] = useState('font-sans');
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<{ url: string; title: string } | null>(null);
  const [showVoiceTemplates, setShowVoiceTemplates] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [postTarget, setPostTarget] = useState<'feed' | 'story' | 'both'>('feed');

  const maxChars = 700;
  const charCount = text.length;

  // Auto-adjust font size based on character count
  const calculateFontSize = () => {
    if (charCount < 50) return 48;
    if (charCount < 100) return 40;
    if (charCount < 200) return 32;
    if (charCount < 300) return 28;
    if (charCount < 400) return 24;
    if (charCount < 500) return 20;
    return 18;
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

  const handleGenerateVoice = async (voiceId: string) => {
    if (!text.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text first',
        variant: 'destructive',
      });
      return;
    }

    const maxDuration = isPremium ? 60 : 30;
    const creditCost = isPremium ? 15 : 20;

    setIsGeneratingVoice(true);
    try {
      // TODO: Call edge function to generate voice using OpenAI TTS
      // For now, just set the selected voice
      setSelectedVoice(voiceId);
      setShowVoiceTemplates(false);
      
      toast({
        title: 'Voice generation',
        description: `${creditCost} credits will be deducted (${maxDuration}s max)`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate voice',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleCreate = () => {
    if (!text.trim()) {
      toast({
        title: 'Empty text',
        description: 'Please enter some text',
        variant: 'destructive',
      });
      return;
    }

    const textConfig: TextConfig = {
      font: selectedFont,
      fontSize,
      backgroundColor,
    };

    onCreate(text, textConfig, selectedMusic?.url, selectedVoice || undefined, postTarget);
  };

  return (
    <>
      <Dialog open={open && !showMusicLibrary} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Create Text Post</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-6">
              {/* Preview */}
              <div 
                className="w-full aspect-[9/16] max-h-[500px] mx-auto mb-6 rounded-lg flex items-center justify-center p-8"
                style={{ backgroundColor: backgroundColor || 'transparent' }}
              >
                <p
                  className={`${selectedFont} text-center leading-relaxed break-words ${backgroundColor ? 'text-white' : 'text-foreground'}`}
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {text || 'Your text will appear here...'}
                </p>
              </div>

              {/* Text Input */}
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Text Content</label>
                  <span className="text-xs text-muted-foreground">
                    {charCount}/{maxChars}
                  </span>
                </div>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, maxChars))}
                  placeholder="Share your thoughts..."
                  className="min-h-[120px] resize-none"
                />
              </div>

              {/* Font Selection */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Font Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map((font) => (
                    <Button
                      key={font.value}
                      variant={selectedFont === font.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedFont(font.value)}
                      className={font.value}
                    >
                      {font.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Background Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {BACKGROUND_COLORS.map((color) => (
                    <Button
                      key={color.name}
                      variant={backgroundColor === color.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBackgroundColor(color.value)}
                      className="justify-start"
                    >
                      {color.value && (
                        <div
                          className="w-4 h-4 rounded mr-2"
                          style={{ backgroundColor: color.value }}
                        />
                      )}
                      {color.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Music Option */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Add Music (60s max)</label>
                <Button
                  variant="outline"
                  onClick={() => setShowMusicLibrary(true)}
                  className="w-full"
                >
                  <Music className="w-4 h-4 mr-2" />
                  {selectedMusic ? selectedMusic.title : 'Select Music'}
                </Button>
              </div>

              {/* Text to Voice */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">
                  Text to Voice AI {isPremium ? '(15 credits - 60s)' : '(20 credits - 30s)'}
                </label>
                {!showVoiceTemplates ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowVoiceTemplates(true)}
                    className="w-full"
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    {selectedVoice ? 'Voice Selected' : 'Add Voice Narration'}
                  </Button>
                ) : (
                  <div className="space-y-2 border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      Select a voice template to narrate your text
                    </p>
                    {VOICE_TEMPLATES.map((voice) => (
                      <Button
                        key={voice.id}
                        variant={selectedVoice === voice.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleGenerateVoice(voice.id)}
                        disabled={isGeneratingVoice}
                        className="w-full justify-start"
                      >
                        <div className="text-left">
                          <p className="font-medium">{voice.name}</p>
                          <p className="text-xs opacity-70">{voice.description}</p>
                        </div>
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowVoiceTemplates(false)}
                      className="w-full mt-2"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">Post to:</label>
                <Select value={postTarget} onValueChange={(value: any) => setPostTarget(value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feed">Feed Only</SelectItem>
                    <SelectItem value="story">Story Only</SelectItem>
                    <SelectItem value="both">Feed & Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>
                  Post
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MusicLibrary
        open={showMusicLibrary}
        onClose={() => setShowMusicLibrary(false)}
        onSelectMusic={handleMusicSelect}
      />
    </>
  );
}
