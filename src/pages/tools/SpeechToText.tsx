import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Copy, Download, Trash2, Sparkles, Languages, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 8;

const LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
];

const SpeechToText = () => {
  const navigate = useNavigate();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'speech_to_text',
    creditCost: CREDIT_COST,
  });
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = language;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      toast.success('Listening...');
    };

    recognitionRef.current.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        toast.error(`Error: ${event.error}`);
      }
      stopListening();
    };

    recognitionRef.current.onend = () => {
      stopListening();
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    toast.success('Copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript downloaded!');
  };

  const handleClear = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

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
              <Mic className="h-5 w-5 text-primary" />
              Speech to Text
            </h1>
            <p className="text-sm text-muted-foreground">Convert speech to text in real-time</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            {CREDIT_COST}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Language Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Languages className="h-5 w-5 text-primary" />
                <span className="font-medium">Language</span>
              </div>
              <Select value={language} onValueChange={setLanguage} disabled={isListening}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recording Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <CardContent className="p-8 text-center">
              <motion.button
                onClick={isListening ? stopListening : startListening}
                className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto transition-all shadow-lg ${
                  isListening 
                    ? 'bg-gradient-to-br from-red-500 to-red-600' 
                    : 'bg-gradient-to-br from-primary to-purple-600 hover:shadow-xl hover:scale-105'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <AnimatePresence mode="wait">
                  {isListening ? (
                    <motion.div
                      key="stop"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <MicOff className="h-12 w-12 text-white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="start"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Mic className="h-12 w-12 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              <p className="text-muted-foreground mt-4">
                {isListening ? 'Tap to stop recording' : 'Tap to start recording'}
              </p>

              <AnimatePresence>
                {isListening && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 space-y-2"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <motion.span
                        className="w-3 h-3 bg-red-500 rounded-full"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="text-red-500 font-medium">Recording</span>
                    </div>
                    <div className="text-2xl font-mono font-bold">
                      {formatDuration(recordingDuration)}
                    </div>
                    {/* Audio Visualizer */}
                    <div className="flex justify-center gap-1 h-8">
                      {[...Array(9)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-primary rounded-full"
                          animate={{
                            height: [8, 24 + Math.random() * 8, 8],
                          }}
                          transition={{
                            duration: 0.4 + Math.random() * 0.3,
                            repeat: Infinity,
                            delay: i * 0.05,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transcript Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Transcript</h3>
                <div className="flex gap-1">
                  {transcript && (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleClear}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <Textarea
                value={transcript + (interimTranscript ? ` ${interimTranscript}` : '')}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your speech will appear here..."
                className="min-h-[200px] text-base"
              />

              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>{wordCount} words • {transcript.length} characters</span>
                {interimTranscript && (
                  <span className="text-primary italic">Processing...</span>
                )}
              </div>
            </CardContent>
          </Card>
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
                  <h4 className="font-medium text-sm mb-2">Tips for Better Results</h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• Speak clearly and at a moderate pace</li>
                    <li>• Use a quiet environment for best accuracy</li>
                    <li>• Keep the microphone close to your mouth</li>
                    <li>• Works best on Chrome, Edge, and Safari</li>
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

export default SpeechToText;