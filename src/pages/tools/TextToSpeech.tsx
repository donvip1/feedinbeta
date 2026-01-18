import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Volume2, Download, Play, Pause, Settings, Sparkles, Wand2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 8;

const TextToSpeech = () => {
  const navigate = useNavigate();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'text_to_speech',
    creditCost: CREDIT_COST,
  });
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState([1]);
  const [pitch, setPitch] = useState([1]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);

  const sampleTexts = [
    "Welcome to FeedIn, your gateway to intelligent conversations.",
    "The quick brown fox jumps over the lazy dog.",
    "In a world of technology, creativity remains our greatest asset.",
    "Learning never exhausts the mind, it only ignites it."
  ];

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !voice) {
        const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        setVoice(englishVoice.name);
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  const handleSpeak = () => {
    if (!text.trim()) {
      toast.error('Please enter some text');
      return;
    }

    if (isPlaying) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentProgress(0);
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
    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentProgress(0);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setCurrentProgress(0);
      toast.error('Speech synthesis failed');
    };
    utterance.onboundary = (event) => {
      if (event.charIndex) {
        setCurrentProgress((event.charIndex / text.length) * 100);
      }
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

  const getVoiceLanguageFlag = (lang: string): string => {
    const flags: Record<string, string> = {
      'en': '🇺🇸', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 
      'it': '🇮🇹', 'pt': '🇧🇷', 'ja': '🇯🇵', 'ko': '🇰🇷',
      'zh': '🇨🇳', 'ru': '🇷🇺', 'ar': '🇸🇦', 'hi': '🇮🇳'
    };
    const langCode = lang.split('-')[0];
    return flags[langCode] || '🌐';
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-primary" />
              Text to Speech
            </h1>
            <p className="text-sm text-muted-foreground">Convert text to natural audio</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            {CREDIT_COST}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Main Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-2 border-primary/20">
            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-4">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Enter Text</h3>
              </div>
            </div>
            <CardContent className="p-4 space-y-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste the text you want to convert to speech..."
                className="min-h-[150px] resize-none text-base"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{text.length} characters</span>
                <span>~{Math.ceil(text.length / 150)} min audio</span>
              </div>

              {/* Sample Texts */}
              <div className="flex flex-wrap gap-2">
                {sampleTexts.map((sample, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setText(sample)}
                  >
                    Sample {i + 1}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Voice Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4 space-y-5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Voice Settings</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Voice</label>
                  <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {availableVoices.map((v) => (
                        <SelectItem key={v.name} value={v.name}>
                          <span className="flex items-center gap-2">
                            <span>{getVoiceLanguageFlag(v.lang)}</span>
                            <span className="truncate">{v.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-muted-foreground">Speed</label>
                    <span className="text-sm font-medium text-primary">{rate[0].toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={rate}
                    onValueChange={setRate}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Slower</span>
                    <span>Faster</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-muted-foreground">Pitch</label>
                    <span className="text-sm font-medium text-primary">{pitch[0].toFixed(1)}</span>
                  </div>
                  <Slider
                    value={pitch}
                    onValueChange={setPitch}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Lower</span>
                    <span>Higher</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Indicator */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-primary rounded-full"
                          animate={{
                            height: [12, 24, 12],
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-purple-500"
                          style={{ width: `${currentProgress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(currentProgress)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3"
        >
          <Button 
            onClick={handleSpeak} 
            disabled={!text.trim()}
            className={`flex-1 h-14 text-lg ${isPlaying ? 'bg-red-500 hover:bg-red-600' : ''}`}
            size="lg"
          >
            {isPlaying ? (
              <>
                <Pause className="h-5 w-5 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Play Audio
              </>
            )}
          </Button>
          <Button 
            onClick={handleDownload}
            variant="outline"
            disabled={!text.trim()}
            size="lg"
            className="h-14"
          >
            <Download className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Tips Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-2">Pro Tips</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Add punctuation for natural pauses</li>
                    <li>• Use commas for short pauses, periods for longer ones</li>
                    <li>• Adjust speed lower for complex content</li>
                    <li>• Try different voices to find the best match</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default TextToSpeech;