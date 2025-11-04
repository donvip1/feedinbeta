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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-screen p-0 bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFacingMode}
              className="text-white hover:bg-white/20"
            >
              <RotateCw className="w-6 h-6" />
            </Button>
          </div>

          {/* Video Preview */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Controls - Fixed with safe area padding */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 pb-safe" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
            {/* Mode Selector */}
            <div className="flex gap-4 bg-black/70 backdrop-blur-sm rounded-full px-6 py-2">
              <button
                onClick={() => setMode('photo')}
                className={`px-4 py-2 rounded-full font-semibold transition-colors text-sm ${
                  mode === 'photo' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                PHOTO
              </button>
              <button
                onClick={() => setMode('video')}
                className={`px-4 py-2 rounded-full font-semibold transition-colors text-sm ${
                  mode === 'video' ? 'bg-white text-black' : 'text-white'
                }`}
              >
                VIDEO
              </button>
            </div>

            {/* Capture Button - Larger and more visible */}
            <button
              onClick={mode === 'photo' ? capturePhoto : isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white transition-all hover:scale-105 active:scale-95 ${
                isRecording ? 'bg-red-500' : 'bg-white'
              }`}
            >
              {mode === 'photo' ? (
                <div className="w-20 h-20 rounded-full border-4 border-black" />
              ) : isRecording ? (
                <Square className="w-10 h-10 fill-white" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-red-500" />
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
