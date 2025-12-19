import { useRef, useState, useCallback, useEffect } from 'react';
import { X, RotateCcw, Zap, ZapOff, Timer, Image as ImageIcon, SwitchCamera } from 'lucide-react';
import { cn } from '@/lib/utils';
import CaptureButton from './CaptureButton';

interface NativeCameraViewProps {
  onCapture: (media: { url: string; type: 'image' | 'video'; file: File }) => void;
  onClose: () => void;
  onGalleryOpen: () => void;
  mode?: 'post' | 'story';
  maxVideoDuration?: number; // in seconds
}

type FlashMode = 'off' | 'on' | 'auto';
type CameraFacing = 'user' | 'environment';

export default function NativeCameraView({
  onCapture,
  onClose,
  onGalleryOpen,
  mode = 'post',
  maxVideoDuration = 60,
}: NativeCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [timerMode, setTimerMode] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastGalleryThumb, setLastGalleryThumb] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        const style = type === 'light' ? ImpactStyle.Light : type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy;
        await Haptics.impact({ style });
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
      }
    } catch {}
  }, []);

  // Initialize camera stream
  const initCamera = useCallback(async (facing: CameraFacing) => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please grant camera permissions.');
    }
  }, []);

  // Load last gallery thumbnail
  useEffect(() => {
    // Try to get a placeholder for gallery preview
    // In a real app, this would access device photos
    setLastGalleryThumb(null);
  }, []);

  useEffect(() => {
    initCamera(cameraFacing);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [cameraFacing, initCamera]);

  // Handle flip camera with animation
  const handleFlipCamera = useCallback(() => {
    triggerHaptic('medium');
    setIsFlipping(true);
    setTimeout(() => {
      setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
      setTimeout(() => setIsFlipping(false), 300);
    }, 150);
  }, [triggerHaptic]);

  // Cycle flash mode
  const handleFlashToggle = useCallback(() => {
    triggerHaptic('light');
    setFlashMode(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }, [triggerHaptic]);

  // Cycle timer mode
  const handleTimerToggle = useCallback(() => {
    triggerHaptic('light');
    setTimerMode(prev => {
      if (prev === 0) return 3;
      if (prev === 3) return 10;
      return 0;
    });
  }, [triggerHaptic]);

  // Handle tap to focus
  const handleTapToFocus = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setFocusPoint({ x, y });
    triggerHaptic('light');
    
    // Remove focus point after animation
    setTimeout(() => setFocusPoint(null), 1000);
  }, [triggerHaptic]);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror if front camera
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    // Flash effect
    if (flashMode !== 'off') {
      const flashEl = document.createElement('div');
      flashEl.className = 'fixed inset-0 bg-white z-[200] animate-flash';
      document.body.appendChild(flashEl);
      setTimeout(() => flashEl.remove(), 100);
    }

    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(file);
        onCapture({ url, type: 'image', file });
      }
    }, 'image/jpeg', 0.95);
  }, [cameraFacing, flashMode, onCapture]);

  // Handle capture with optional timer
  const handleCapture = useCallback(() => {
    if (timerMode === 0) {
      capturePhoto();
      return;
    }

    // Start countdown
    setCountdown(timerMode);
    let remaining = timerMode;

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current!);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(remaining);
        triggerHaptic('light');
      }
    }, 1000);
  }, [timerMode, capturePhoto, triggerHaptic]);

  // Start recording
  const handleRecordStart = useCallback(() => {
    if (!streamRef.current) return;

    recordedChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
      const url = URL.createObjectURL(file);
      onCapture({ url, type: 'video', file });
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordProgress(0);

    // Progress timer
    let elapsed = 0;
    recordIntervalRef.current = setInterval(() => {
      elapsed += 0.1;
      const progress = (elapsed / maxVideoDuration) * 100;
      setRecordProgress(Math.min(progress, 100));

      if (elapsed >= maxVideoDuration) {
        handleRecordEnd();
      }
    }, 100);
  }, [maxVideoDuration, onCapture]);

  // End recording
  const handleRecordEnd = useCallback(() => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordProgress(0);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera viewfinder */}
      <div 
        className="relative flex-1 overflow-hidden"
        onClick={handleTapToFocus}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'absolute inset-0 w-full h-full object-cover',
            cameraFacing === 'user' && 'scale-x-[-1]',
            isFlipping && 'animate-flip-camera'
          )}
        />

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-center p-8">
            <p>{error}</p>
          </div>
        )}

        {/* Focus ring */}
        {focusPoint && (
          <div
            className="absolute w-16 h-16 border-2 border-yellow-400 rounded-lg animate-focus-ring pointer-events-none"
            style={{
              left: focusPoint.x - 32,
              top: focusPoint.y - 32,
            }}
          />
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-8xl font-bold text-white animate-scale-in">
              {countdown}
            </span>
          </div>
        )}

        {/* Mode indicator */}
        {mode === 'story' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary/80 rounded-full">
            <span className="text-white text-sm font-medium">Story</span>
          </div>
        )}
      </div>

      {/* Top controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 safe-area-top">
        {/* Close button */}
        <button
          onClick={onClose}
          className="p-3 rounded-full bg-black/40 backdrop-blur-sm active:scale-95 transition-transform"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Flash toggle */}
          <button
            onClick={handleFlashToggle}
            className="p-3 rounded-full bg-black/40 backdrop-blur-sm active:scale-95 transition-transform"
          >
            {flashMode === 'off' ? (
              <ZapOff className="w-6 h-6 text-white" />
            ) : (
              <Zap className={cn(
                'w-6 h-6',
                flashMode === 'on' ? 'text-yellow-400' : 'text-white'
              )} />
            )}
            {flashMode === 'auto' && (
              <span className="absolute -bottom-1 text-[8px] text-white font-bold">A</span>
            )}
          </button>

          {/* Timer toggle */}
          <button
            onClick={handleTimerToggle}
            className={cn(
              'p-3 rounded-full bg-black/40 backdrop-blur-sm active:scale-95 transition-transform',
              timerMode > 0 && 'bg-primary/60'
            )}
          >
            <Timer className="w-6 h-6 text-white" />
            {timerMode > 0 && (
              <span className="absolute -bottom-1 -right-1 text-[10px] bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {timerMode}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 backdrop-blur-xl py-8 px-4 safe-area-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Gallery button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onGalleryOpen();
            }}
            className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white/30 active:scale-95 transition-transform"
          >
            {lastGalleryThumb ? (
              <img src={lastGalleryThumb} alt="Gallery" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-white/60" />
              </div>
            )}
          </button>

          {/* Capture button */}
          <CaptureButton
            onCapture={handleCapture}
            onRecordStart={handleRecordStart}
            onRecordEnd={handleRecordEnd}
            isRecording={isRecording}
            recordProgress={recordProgress}
            disabled={!isReady || countdown !== null}
          />

          {/* Flip camera button */}
          <button
            onClick={handleFlipCamera}
            className={cn(
              'w-14 h-14 rounded-full bg-white/10 flex items-center justify-center',
              'active:scale-95 transition-all duration-150',
              isFlipping && 'rotate-180'
            )}
            style={{ transition: isFlipping ? 'transform 0.3s ease-out' : 'transform 0.15s' }}
          >
            <SwitchCamera className="w-7 h-7 text-white" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-center text-white/50 text-xs mt-4">
          {isRecording ? 'Release to stop' : 'Tap for photo • Hold for video'}
        </p>
      </div>
    </div>
  );
}
