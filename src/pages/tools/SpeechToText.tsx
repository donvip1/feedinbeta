import { useState, useRef, ChangeEvent } from 'react';
import { ArrowLeft, Mic, MicOff, Copy, Download, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';

const SpeechToText = () => {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
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
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript('');
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
    a.download = 'transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript downloaded!');
  };

  const handleClear = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Speech to Text</h1>
            <p className="text-sm text-muted-foreground">Convert speech to text</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto transition-all ${
                isListening 
                  ? 'bg-red-500 animate-pulse' 
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {isListening ? (
                <MicOff className="h-10 w-10 text-white" />
              ) : (
                <Mic className="h-10 w-10 text-white" />
              )}
            </button>

            <p className="text-sm text-muted-foreground">
              {isListening ? 'Tap to stop recording' : 'Tap to start recording'}
            </p>

            {isListening && (
              <div className="flex items-center justify-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-red-500">Recording...</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Transcript</h3>
              <div className="flex gap-2">
                {transcript && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <Textarea
              value={transcript + interimTranscript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your speech will appear here..."
              className="min-h-[200px]"
            />

            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {transcript.split(/\s+/).filter(Boolean).length} words
              </span>
              {transcript && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-muted/50">
          <div className="text-sm space-y-2">
            <h4 className="font-medium">Tips for better results:</h4>
            <ul className="text-muted-foreground space-y-1">
              <li>• Speak clearly and at a moderate pace</li>
              <li>• Use a quiet environment</li>
              <li>• Keep the microphone close</li>
              <li>• Supported: Chrome, Edge, Safari</li>
            </ul>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default SpeechToText;
