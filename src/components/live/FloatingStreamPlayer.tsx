import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Users } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

export const FloatingStreamPlayer: React.FC = () => {
  const streamContext = useOptionalLiveStreamContext();
  const navigate = useNavigate();
  const [position, setPosition] = useState({ x: 16, y: 100 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState('0:00');

  // Update duration every second
  useEffect(() => {
    if (!streamContext?.streamState.streamInfo?.startedAt) return;
    
    const interval = setInterval(() => {
      const start = new Date(streamContext.streamState.streamInfo!.startedAt).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [streamContext?.streamState.streamInfo?.startedAt]);

  // Attach video track to element
  useEffect(() => {
    if (videoRef.current && streamContext?.videoTrack) {
      streamContext.videoTrack.attach(videoRef.current);
      return () => {
        if (videoRef.current && streamContext?.videoTrack) {
          streamContext.videoTrack.detach(videoRef.current);
        }
      };
    }
  }, [streamContext?.videoTrack]);

  // Don't render if no active minimized stream
  if (!streamContext || !streamContext.streamState.isActive || !streamContext.streamState.isMinimized) {
    return null;
  }

  const { streamState, toggleMute, toggleCamera, maximizeStream, endStream } = streamContext;

  const handleMaximize = () => {
    maximizeStream();
    const streamId = streamState.streamInfo?.id;
    if (streamId) {
      navigate(`/live/stream/${streamId}`);
    }
  };

  const handleEndStream = async () => {
    await endStream();
    navigate('/live');
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;
    
    // Snap to edges
    const screenWidth = window.innerWidth;
    const widgetWidth = 140;
    
    const snappedX = newX < screenWidth / 2 - widgetWidth / 2 ? 16 : screenWidth - widgetWidth - 16;
    
    setPosition({
      x: snappedX,
      y: Math.max(50, Math.min(newY, window.innerHeight - 280)),
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        drag
        dragMomentum={false}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
        }}
        className="touch-none"
      >
        <div className="w-36 aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black">
          {/* Video Preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
          
          {/* Top info bar */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            {/* Live indicator */}
            <div className="flex items-center gap-1 bg-red-600 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-white">LIVE</span>
            </div>
            
            {/* Viewer count */}
            <div className="flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-full">
              <Users className="w-2.5 h-2.5 text-white" />
              <span className="text-[9px] text-white">{streamState.viewerCount}</span>
            </div>
          </div>
          
          {/* Duration */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <span className="text-[10px] text-white/80 font-mono">{duration}</span>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-2 left-2 right-2 space-y-2">
            {/* Host info */}
            <div className="flex items-center gap-1.5">
              <Avatar className="w-5 h-5 border border-white/30">
                <AvatarImage src={streamState.streamInfo?.hostAvatar || ''} />
                <AvatarFallback className="text-[8px] bg-primary/30">
                  {streamState.streamInfo?.hostName?.[0] || 'H'}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-white font-medium truncate flex-1">
                {streamState.streamInfo?.hostName || 'You'}
              </span>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center justify-between gap-1">
              {/* Mic toggle */}
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMute}
                className={cn(
                  "h-7 w-7 rounded-full",
                  streamState.isMuted 
                    ? 'bg-red-500/30 text-red-400' 
                    : 'bg-white/20 text-white'
                )}
              >
                {streamState.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              </Button>

              {/* Camera toggle */}
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleCamera}
                className={cn(
                  "h-7 w-7 rounded-full",
                  !streamState.isCameraOn 
                    ? 'bg-red-500/30 text-red-400' 
                    : 'bg-white/20 text-white'
                )}
              >
                {streamState.isCameraOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              </Button>

              {/* Maximize */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleMaximize}
                className="h-7 w-7 rounded-full bg-primary/30 text-primary hover:bg-primary/40"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>

              {/* End stream */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleEndStream}
                className="h-7 w-7 rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                <PhoneOff className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingStreamPlayer;
