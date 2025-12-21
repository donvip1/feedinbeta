import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalCallContext } from '@/context/CallContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, Video, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';

export const FloatingCallWidget: React.FC = () => {
  const callContext = useOptionalCallContext();
  const navigate = useNavigate();
  const [position, setPosition] = useState({ x: 16, y: 100 });
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Don't render if no active minimized call
  if (!callContext || !callContext.callState.isActive || !callContext.callState.isMinimized) {
    return null;
  }

  const { callState, toggleMute, endCall, maximizeCall } = callContext;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMaximize = () => {
    maximizeCall();
    navigate(`/call?callId=${callState.callId}`);
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;
    
    // Snap to edges
    const screenWidth = window.innerWidth;
    const widgetWidth = 180;
    
    const snappedX = newX < screenWidth / 2 - widgetWidth / 2 ? 16 : screenWidth - widgetWidth - 16;
    
    setPosition({
      x: snappedX,
      y: Math.max(50, Math.min(newY, window.innerHeight - 200)),
    });
  };

  return (
    <>
      {/* Invisible constraints container */}
      <div 
        ref={constraintsRef} 
        className="fixed inset-0 pointer-events-none z-[90]"
      />
      
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          drag
          dragControls={dragControls}
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
          <div className="bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900 rounded-2xl shadow-2xl border border-primary/30 overflow-hidden backdrop-blur-xl">
            {/* Video preview for video calls */}
            {callState.callType === 'video' && callState.remoteStream && (
              <div className="w-44 h-24 bg-black relative">
                <video
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  ref={(el) => {
                    if (el && callState.remoteStream) {
                      el.srcObject = callState.remoteStream;
                    }
                  }}
                />
                {/* Local video thumbnail */}
                {callState.localStream && (
                  <div className="absolute bottom-1 right-1 w-12 h-16 rounded-md overflow-hidden border border-white/20">
                    <video
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el && callState.localStream) {
                          el.srcObject = callState.localStream;
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Call info section */}
            <div className="p-3 flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10 border-2 border-primary/50">
                  <AvatarImage src={callState.otherUserProfile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {callState.otherUserProfile?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                {callState.isConnected && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {callState.otherUserProfile?.display_name || 'Unknown'}
                </p>
                <p className="text-xs text-primary">
                  {callState.isConnected 
                    ? formatDuration(callState.callDuration)
                    : 'Connecting...'}
                </p>
              </div>
            </div>

            {/* Control buttons */}
            <div className="px-3 pb-3 flex items-center justify-between gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMute}
                className={`h-8 w-8 rounded-full ${
                  callState.isMuted 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-white/10 text-white'
                }`}
              >
                {callState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleMaximize}
                className="h-8 w-8 rounded-full bg-primary/20 text-primary hover:bg-primary/30"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={endCall}
                className="h-8 w-8 rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Hidden audio element for voice calls */}
      {callState.callType === 'voice' && callState.remoteStream && (
        <audio
          autoPlay
          playsInline
          ref={(el) => {
            if (el && callState.remoteStream) {
              el.srcObject = callState.remoteStream;
            }
          }}
        />
      )}
    </>
  );
};

export default FloatingCallWidget;
