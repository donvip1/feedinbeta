import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalLiveStreamContext } from '@/context/LiveStreamContext';
import { X, Maximize2, Play } from 'lucide-react';
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
        className="fixed bottom-24 right-4 z-50 group"
      >
        <div className="w-44 aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          {/* Video Preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover opacity-80"
          />
          
          {/* Play indicator */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center animate-pulse">
              <Play className="w-4 h-4 text-white fill-current" />
            </div>
          </div>

          {/* Live badge */}
          <div className="absolute top-2 left-2 bg-rose-600 px-2 py-0.5 rounded-full flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white">Live</span>
          </div>

          {/* Hover controls */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleMaximize}
              className="p-1.5 bg-black/50 backdrop-blur-sm rounded-lg hover:bg-black/70 transition-colors"
            >
              <Maximize2 className="w-3 h-3 text-white" />
            </button>
            <button
              onClick={handleEndStream}
              className="p-1.5 bg-rose-500/80 rounded-lg hover:bg-rose-600 transition-colors"
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
