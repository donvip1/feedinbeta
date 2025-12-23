import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, CheckCircle, AlertCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TestAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestAudioModal = ({ isOpen, onClose }: TestAudioModalProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micDetected, setMicDetected] = useState(false);
  const [peakLevel, setPeakLevel] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopListening();
    }
    
    return () => stopListening();
  }, [isOpen]);

  const startListening = async () => {
    try {
      setIsListening(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setStream(mediaStream);
      setHasPermission(true);
      
      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      const analyzer = audioContextRef.current.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      analyzerRef.current = analyzer;
      
      // Start monitoring
      monitorAudio();
    } catch (error) {
      console.error('[TestAudio] Failed to get microphone:', error);
      setHasPermission(false);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (peakTimeoutRef.current) {
      clearTimeout(peakTimeoutRef.current);
    }
    
    setIsListening(false);
    setAudioLevel(0);
    setMicDetected(false);
    setPeakLevel(0);
    setHasPermission(null);
  };

  const monitorAudio = () => {
    if (!analyzerRef.current) return;
    
    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalized = Math.min(average / 128, 1);
    
    setAudioLevel(normalized);
    
    // Track peak level for speaking detection
    if (normalized > peakLevel) {
      setPeakLevel(normalized);
    }
    
    // Mark as detected if we get consistent audio above threshold
    if (normalized > 0.15) {
      setMicDetected(true);
      if (peakTimeoutRef.current) {
        clearTimeout(peakTimeoutRef.current);
      }
      peakTimeoutRef.current = setTimeout(() => {
        setPeakLevel(prev => prev * 0.5);
      }, 2000);
    }
    
    animationFrameRef.current = requestAnimationFrame(monitorAudio);
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  // Generate bars for the audio visualizer
  const bars = Array.from({ length: 20 }, (_, i) => {
    const barLevel = Math.sin((i / 20) * Math.PI) * audioLevel * 100;
    return Math.max(10, barLevel);
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Test Your Microphone
          </DialogTitle>
          <DialogDescription>
            Speak into your microphone to verify it's working properly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-3">
            {hasPermission === false ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-6 h-6" />
                <span className="font-medium">Microphone access denied</span>
              </div>
            ) : micDetected ? (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 text-green-500"
              >
                <CheckCircle className="w-6 h-6" />
                <span className="font-medium">Microphone is working!</span>
              </motion.div>
            ) : isListening ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Volume2 className="w-6 h-6 animate-pulse" />
                <span className="font-medium">Listening... Speak now</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MicOff className="w-6 h-6" />
                <span className="font-medium">Microphone off</span>
              </div>
            )}
          </div>

          {/* Audio level visualizer */}
          <div className="relative h-32 bg-muted/30 rounded-xl overflow-hidden border border-border/50">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
            
            {/* Audio bars */}
            <div className="absolute inset-0 flex items-end justify-center gap-1 p-4">
              {bars.map((height, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    "w-2 rounded-t-full",
                    micDetected 
                      ? "bg-gradient-to-t from-green-500 to-emerald-400" 
                      : "bg-gradient-to-t from-primary to-primary/60"
                  )}
                  animate={{ 
                    height: `${Math.max(8, height)}%`,
                    opacity: 0.3 + (height / 100) * 0.7
                  }}
                  transition={{ 
                    duration: 0.05,
                    ease: "linear"
                  }}
                />
              ))}
            </div>

            {/* Level percentage */}
            <div className="absolute bottom-2 right-2 text-xs font-mono text-muted-foreground">
              {Math.round(audioLevel * 100)}%
            </div>
          </div>

          {/* Circular level indicator */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Pulsing rings when speaking */}
              {audioLevel > 0.1 && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                    animate={{ 
                      scale: 1 + audioLevel * 0.5,
                      opacity: [0.5, 0]
                    }}
                    transition={{ 
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/20"
                    animate={{ 
                      scale: 1 + audioLevel * 0.8,
                      opacity: [0.3, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: 0.2
                    }}
                  />
                </>
              )}
              
              {/* Main microphone icon */}
              <motion.div
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-colors",
                  micDetected 
                    ? "bg-green-500/20 text-green-500" 
                    : isListening 
                    ? "bg-primary/20 text-primary" 
                    : "bg-muted text-muted-foreground"
                )}
                animate={{ 
                  scale: 1 + audioLevel * 0.15
                }}
                transition={{ duration: 0.1 }}
              >
                {isListening ? (
                  <Mic className="w-10 h-10" />
                ) : (
                  <MicOff className="w-10 h-10" />
                )}
              </motion.div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-muted-foreground space-y-1">
            {hasPermission === false ? (
              <p>Please allow microphone access in your browser settings and try again.</p>
            ) : (
              <>
                <p>Say something like "Hello, testing 1, 2, 3"</p>
                <p className="text-xs">The bars should move when you speak</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {!isListening && hasPermission !== false && (
            <Button 
              onClick={startListening} 
              className="flex-1"
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Test
            </Button>
          )}
          <Button 
            variant={micDetected ? "default" : "outline"}
            onClick={handleClose} 
            className={cn("flex-1", micDetected && "bg-green-500 hover:bg-green-600")}
          >
            {micDetected ? "Done" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
