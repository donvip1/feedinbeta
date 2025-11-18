import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, RefreshCw, Circle, Square, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstagramStylePostDetails } from './InstagramStylePostDetails';

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, mediaType: 'image' | 'video', effects?: any, postToStory?: boolean) => void;
  onSwitchToGallery?: () => void;
  onTextPost?: () => void;
}

const FILTERS = [
  { name: 'Normal', filter: 'none' },
  { name: 'Vivid', filter: 'contrast(1.2) saturate(1.4)' },
  { name: 'Bright', filter: 'brightness(1.2) contrast(1.1)' },
  { name: 'Warm', filter: 'sepia(0.3) saturate(1.2)' },
  { name: 'Cool', filter: 'hue-rotate(180deg) saturate(1.1)' },
  { name: 'B&W', filter: 'grayscale(1) contrast(1.2)' },
];

export function CameraCapture({ open, onClose, onCapture, onSwitchToGallery }: CameraCaptureProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const [capturedMediaUrl, setCapturedMediaUrl] = useState<string | null>(null);
  const [capturedMediaType, setCapturedMediaType] = useState<'image' | 'video'>('image');
  const [capturedMediaFile, setCapturedMediaFile] = useState<File | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('Normal');
  const [showPostDetails, setShowPostDetails] = useState(false);

  useEffect(() => {
    if (open && !capturedMediaUrl) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: mode === 'video',
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handlePhotoCapture = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedMediaUrl(url);
        setCapturedMediaType('image');
        setCapturedMediaFile(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const startVideoRecording = () => {
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const file = new File([blob], `video-${Date.now()}.mp4`, { type: 'video/mp4' });
      setCapturedMediaUrl(url);
      setCapturedMediaType('video');
      setCapturedMediaFile(file);
      stopCamera();
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRetake = () => {
    setCapturedMediaUrl(null);
    setCapturedMediaFile(null);
    setSelectedFilter('Normal');
    startCamera();
  };

  const handleNext = () => {
    setShowPostDetails(true);
  };

  const getFilterStyle = () => {
    const filterObj = FILTERS.find(f => f.name === selectedFilter);
    return { filter: filterObj?.filter || 'none' };
  };

  if (showPostDetails && capturedMediaUrl && capturedMediaFile) {
    return (
      <InstagramStylePostDetails
        open={true}
        onClose={onClose}
        onBack={() => setShowPostDetails(false)}
        mediaUrl={capturedMediaUrl}
        mediaType={capturedMediaType}
        effects={{ filter: selectedFilter }}
        mediaFile={capturedMediaFile}
        onSuccess={() => {
          setCapturedMediaUrl(null);
          setCapturedMediaFile(null);
          setShowPostDetails(false);
          onClose();
        }}
      />
    );
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-screen p-0 bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </Button>
              {!capturedMediaUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  className="text-white hover:bg-white/20"
                >
                  <RefreshCw className="w-6 h-6" />
                </Button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center bg-black">
            {capturedMediaUrl ? (
              <div className="relative w-full h-full">
                {capturedMediaType === 'image' ? (
                  <img
                    src={capturedMediaUrl}
                    alt="Captured"
                    className="w-full h-full object-contain"
                    style={getFilterStyle()}
                  />
                ) : (
                  <video
                    src={capturedMediaUrl}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                )}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent">
            {capturedMediaUrl ? (
              <>
                {/* Filters */}
                <div className="px-4 pb-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {FILTERS.map((filter) => (
                      <button
                        key={filter.name}
                        onClick={() => setSelectedFilter(filter.name)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedFilter === filter.name
                            ? 'bg-white text-black'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {filter.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-4 pb-8">
                  <Button
                    onClick={handleRetake}
                    variant="outline"
                    className="bg-black/60 backdrop-blur-md text-white hover:bg-black/80 border-white/30"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 px-8"
                  >
                    Next
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Mode Selector */}
                <div className="flex justify-center gap-8 pb-4">
                  <button
                    onClick={() => setMode('photo')}
                    className={`text-lg font-bold ${
                      mode === 'photo' ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    Photo
                  </button>
                  <button
                    onClick={() => setMode('video')}
                    className={`text-lg font-bold ${
                      mode === 'video' ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    Video
                  </button>
                </div>

                {/* Recording Time */}
                {isRecording && (
                  <div className="text-center pb-4">
                    <div className="inline-flex items-center gap-2 bg-red-500 px-4 py-2 rounded-full">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      <span className="text-white font-mono">
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Capture Buttons */}
                <div className="flex items-center justify-center gap-6 pb-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSwitchToGallery}
                    className="text-white hover:bg-white/20 w-12 h-12"
                  >
                    <ImageIcon className="w-8 h-8" />
                  </Button>

                  <button
                    onClick={mode === 'photo' ? handlePhotoCapture : isRecording ? stopVideoRecording : startVideoRecording}
                    className="relative"
                  >
                    {mode === 'photo' ? (
                      <div className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-all" />
                    ) : (
                      <div className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                        isRecording ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
                      }`}>
                        {isRecording ? (
                          <Square className="w-8 h-8 text-white fill-white" />
                        ) : (
                          <Circle className="w-16 h-16 text-red-500 fill-red-500" />
                        )}
                      </div>
                    )}
                  </button>

                  <div className="w-12 h-12" />
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
