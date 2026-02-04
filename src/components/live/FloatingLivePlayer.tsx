import { useRef, useEffect, useState } from 'react';
import { motion, useDragControls, PanInfo } from 'framer-motion';
import { 
  X, Maximize2, Mic, MicOff, Video, VideoOff, 
  Radio, Users, Zap 
} from 'lucide-react';
import { useUnifiedLive } from '@/context/UnifiedLiveContext';
import { AudioVisualizer } from '@/components/live/unified/AudioVisualizer';
import { cn } from '@/lib/utils';

// Format duration as mm:ss
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const FloatingLivePlayer = () => {
  const { state, maximize, leaveRoom, toggleMute, toggleCamera, videoTrack } = useUnifiedLive();
  const { roomInfo, isMinimized, isMuted, isCameraOn, connectionStatus, viewerCount } = state;
  
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  // Attach video track
  useEffect(() => {
    if (videoRef.current && videoTrack && roomInfo?.type !== 'audio_space') {
      videoTrack.attach(videoRef.current);
      return () => {
        videoTrack.detach(videoRef.current!);
      };
    }
  }, [videoTrack, roomInfo?.type]);

  // Duration timer
  useEffect(() => {
    if (state.isActive && roomInfo?.startedAt) {
      const startTime = new Date(roomInfo.startedAt).getTime();
      const interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.isActive, roomInfo?.startedAt]);

  if (!isMinimized || !roomInfo) return null;

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Snap to edges logic can be added here
  };

  const renderContent = () => {
    switch (roomInfo.type) {
      case 'audio_space':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-900/90 to-teal-900/90">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <img 
                  src={roomInfo.hostAvatar} 
                  alt={roomInfo.hostName}
                  className="w-12 h-12 rounded-full border-2 border-emerald-400"
                />
                <AudioVisualizer 
                  active={connectionStatus === 'connected' && !isMuted} 
                  barCount={3}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 scale-75"
                  color="bg-emerald-400"
                />
              </div>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        );

      case 'pk_battle':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/90 to-pink-900/90">
            <Zap className="w-8 h-8 text-yellow-400" />
          </div>
        );

      default: // video_broadcast
        return (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        );
    }
  };

  return (
    <>
      {/* Drag constraints container */}
      <div 
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{ padding: '20px' }}
      />

      {/* Floating Player */}
      <motion.div
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        initial={{ scale: 0.8, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 100 }}
        className={cn(
          "fixed bottom-24 right-4 z-[70]",
          "w-32 h-48 rounded-2xl overflow-hidden",
          "shadow-2xl shadow-black/50",
          "border-2",
          roomInfo.type === 'audio_space' ? "border-emerald-500/50" : 
          roomInfo.type === 'pk_battle' ? "border-purple-500/50" : 
          "border-primary/50",
          "cursor-grab active:cursor-grabbing"
        )}
        style={{ touchAction: 'none' }}
      >
        {/* Content */}
        {renderContent()}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-white font-semibold">LIVE</span>
          </div>
          <div className="flex items-center gap-1 text-white/80">
            <Users className="w-3 h-3" />
            <span className="text-[10px]">{viewerCount}</span>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[10px] text-white/70 truncate mb-2">{roomInfo.title}</p>
          <div className="flex items-center justify-between gap-1">
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className={cn(
                  "p-1.5 rounded-full",
                  isMuted ? "bg-red-500/80" : "bg-white/20"
                )}
              >
                {isMuted ? <MicOff className="w-3 h-3 text-white" /> : <Mic className="w-3 h-3 text-white" />}
              </button>

              {roomInfo.type !== 'audio_space' && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
                  className={cn(
                    "p-1.5 rounded-full",
                    !isCameraOn ? "bg-red-500/80" : "bg-white/20"
                  )}
                >
                  {isCameraOn ? <Video className="w-3 h-3 text-white" /> : <VideoOff className="w-3 h-3 text-white" />}
                </button>
              )}
            </div>

            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); maximize(); }}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30"
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); leaveRoom(); }}
                className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Duration Badge */}
        {duration > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded-full">
            <span className="text-[10px] text-white font-mono">{formatDuration(duration)}</span>
          </div>
        )}
      </motion.div>
    </>
  );
};
