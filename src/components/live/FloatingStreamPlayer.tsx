import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { X, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const FloatingStreamPlayer: React.FC = () => {
  const streamContext = useOptionalLiveStreamContext();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const { streamState, maximizeStream, endStream } = streamContext;

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-24 right-4 z-50"
        drag
        dragMomentum={false}
      >
        <div className="w-36 h-48 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
          {/* Video Preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Gradient overlay for controls */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />

          {/* Live badge */}
          <div className="absolute top-2 left-2 bg-rose-600 px-2 py-0.5 rounded-full flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Live</span>
          </div>

          {/* Stream title */}
          <div className="absolute bottom-8 left-2 right-2">
            <span className="text-[10px] text-white/80 font-bold truncate block">
              {streamState.streamInfo?.title || 'Live Stream'}
            </span>
          </div>

          {/* Bottom controls - always visible */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between">
            <button
              onClick={handleMaximize}
              className="px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3 text-white" />
              <span className="text-[9px] font-bold text-white">Return</span>
            </button>
            <button
              onClick={handleEndStream}
              className="p-1.5 bg-rose-500/80 rounded-full"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingStreamPlayer;
