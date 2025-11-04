import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, RotateCw, Circle, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, mediaType: 'image' | 'video') => void;
}

export function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '4:3' | '16:9'>('9:16');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, facingMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: mode === 'video',
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access to use this feature',
        variant: 'destructive',
      });
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, 'image');
        onClose();
      }
    }, 'image/jpeg');
  };

  const startRecording = () => {
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      onCapture(file, 'video');
      onClose();
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordedChunks(chunks);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '1:1': return 'aspect-square';
      case '4:3': return 'aspect-[4/3]';
      case '16:9': return 'aspect-[16/9]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-[9/16]';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-screen p-0 bg-black">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Header - Compact */}
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between px-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </Button>
            
            {/* Camera Switch */}
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFacingMode}
              className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
            >
              <RotateCw className="w-5 h-5" />
            </Button>
          </div>

          {/* Aspect Ratio Selector - Top Center */}
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            {(['9:16', '1:1', '4:3', '16:9'] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  aspectRatio === ratio 
                    ? 'bg-white text-black' 
                    : 'text-white hover:bg-white/20'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Video Preview - Centered with aspect ratio */}
          <div className={`relative ${getAspectRatioClass()} w-full max-h-full flex items-center justify-center bg-black`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Overlay Controls */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-6">
              {/* Mode Selector - Semi-transparent overlay */}
              <div className="flex gap-3 bg-black/40 backdrop-blur-md rounded-full px-4 py-1.5">
                <button
                  onClick={() => setMode('photo')}
                  className={`px-4 py-1.5 rounded-full font-semibold transition-all text-xs ${
                    mode === 'photo' 
                      ? 'bg-white text-black shadow-lg' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  PHOTO
                </button>
                <button
                  onClick={() => setMode('video')}
                  className={`px-4 py-1.5 rounded-full font-semibold transition-all text-xs ${
                    mode === 'video' 
                      ? 'bg-white text-black shadow-lg' 
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  VIDEO
                </button>
              </div>

              {/* Capture Button - Large, semi-transparent overlay */}
              <button
                onClick={mode === 'photo' ? capturePhoto : isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 ${
                  isRecording 
                    ? 'bg-red-500/90 border-4 border-white' 
                    : 'bg-white/90 border-4 border-white'
                }`}
                style={{ backdropFilter: 'blur(8px)' }}
              >
                {mode === 'photo' ? (
                  <Circle className="w-16 h-16 text-black" strokeWidth={3} />
                ) : isRecording ? (
                  <Square className="w-8 h-8 fill-white" />
                ) : (
                  <Circle className="w-16 h-16 fill-red-500 text-red-500" />
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
