import { useState, useEffect } from 'react';
import { ArrowLeft, Volume2, Download, Loader2, Play, Pause, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';

const TextToSpeech = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState([1]);
  const [pitch, setPitch] = useState([1]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !voice) {
        setVoice(voices[0].name);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleSpeak = () => {
    if (!text.trim()) {
      toast.error('Please enter some text');
      return;
    }

    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = availableVoices.find(v => v.name === voice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = rate[0];
    utterance.pitch = pitch[0];

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => {
      setIsPlaying(false);
      toast.error('Speech synthesis failed');
    };

    speechSynthesis.speak(utterance);
    toast.success('Playing audio...');
  };

  const handleDownload = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text first');
      return;
    }

    toast.info('Audio download requires a premium TTS service. For now, use the play button to listen.');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Text to Speech</h1>
            <p className="text-sm text-muted-foreground">Convert text to audio</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Text</h3>
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste the text you want to convert to speech..."
              className="min-h-[150px]"
            />

            <div className="text-xs text-muted-foreground text-right">
              {text.length} characters
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Voice Settings</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Voice</label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Speed: {rate[0].toFixed(1)}x
                </label>
                <Slider
                  value={rate}
                  onValueChange={setRate}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Pitch: {pitch[0].toFixed(1)}
                </label>
                <Slider
                  value={pitch}
                  onValueChange={setPitch}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button 
            onClick={handleSpeak} 
            disabled={!text.trim()}
            className="flex-1"
            variant={isPlaying ? 'secondary' : 'default'}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Play
              </>
            )}
          </Button>
          <Button 
            onClick={handleDownload}
            variant="outline"
            disabled={!text.trim()}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default TextToSpeech;
