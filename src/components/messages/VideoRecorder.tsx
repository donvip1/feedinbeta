import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Video, 
  X, 
  Circle, 
  Square, 
  RotateCw, 
  Sparkles,
  Check,
  Camera
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface VideoRecorderProps {
  open: boolean;
  onClose: () => void;
  onSave: (videoBlob: Blob) => void;
}

const VIDEO_FILTERS = [
  { name: 'Normal', filter: 'none' },
  { name: 'Cool', filter: 'hue-rotate(180deg) saturate(1.5)' },
  { name: 'Warm', filter: 'sepia(0.3) saturate(1.3)' },
  { name: 'B&W', filter: 'grayscale(1) contrast(1.2)' },
  { name: 'Vintage', filter: 'sepia(0.5) contrast(1.2) brightness(0.9)' },
  { name: 'Bright', filter: 'brightness(1.2) contrast(1.1)' },
];

export const VideoRecorder = ({ open, onClose, onSave }: VideoRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, facingMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true,
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera',
        variant: 'destructive',
      });
      onClose();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      
      // Show preview
      if (previewRef.current) {
        previewRef.current.src = URL.createObjectURL(blob);
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);

    // Start timer
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      stopCamera();
    }
  };

  const handleSave = () => {
    if (recordedBlob) {
      onSave(recordedBlob);
      toast({ title: 'Video saved' });
    }
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setRecordingTime(0);
    startCamera();
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-screen w-screen max-w-none m-0 p-0 bg-black border-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={recordedBlob ? handleRetake : onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
          
          {isRecording && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/80 rounded-full">
              <Circle className="w-3 h-3 fill-white" />
              <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
            </div>
          )}

          {recordedBlob && (
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Check className="w-4 h-4 mr-2" />
              Send
            </Button>
          )}
        </div>

        {/* Video Preview */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0">
          {!recordedBlob ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{
                filter: VIDEO_FILTERS[selectedFilter].filter,
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}
              playsInline
              muted
            />
          ) : (
            <video
              ref={previewRef}
              className="w-full h-full object-cover"
              style={{
                filter: VIDEO_FILTERS[selectedFilter].filter,
              }}
              controls
              playsInline
            />
          )}

          {/* Recording time overlay */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-lg font-bold">
              Max 60s
            </div>
          )}
        </div>

        {/* Controls */}
        {!recordedBlob && (
          <div className="bg-background/95 backdrop-blur p-4 space-y-4 border-t border-border shrink-0">
            {/* Filters */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">Filters</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {VIDEO_FILTERS.map((filter, idx) => (
                  <Button
                    key={filter.name}
                    variant={selectedFilter === idx ? 'default' : 'outline'}
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => setSelectedFilter(idx)}
                    disabled={isRecording}
                  >
                    {filter.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex items-center justify-center gap-8">
              <Button
                variant="outline"
                size="icon"
                onClick={switchCamera}
                disabled={isRecording}
                className="h-12 w-12"
              >
                <RotateCw className="w-5 h-5" />
              </Button>

              {!isRecording ? (
                <Button
                  size="icon"
                  onClick={startRecording}
                  className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600"
                >
                  <Circle className="w-8 h-8" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={stopRecording}
                  className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600"
                >
                  <Square className="w-6 h-6 fill-white" />
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => toast({ title: 'Feature coming soon' })}
                disabled={isRecording}
                className="h-12 w-12"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
