import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalSpaceContext } from '@/context/SpaceContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Maximize2, X, Users } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

export const FloatingSpacePlayer: React.FC = () => {
  const spaceContext = useOptionalSpaceContext();
  const navigate = useNavigate();
  const [position, setPosition] = useState({ x: 16, y: 100 });
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [duration, setDuration] = useState('0:00');

  // Update duration every second
  React.useEffect(() => {
    if (!spaceContext?.spaceState.spaceInfo?.startedAt) return;
    
    const interval = setInterval(() => {
      const start = new Date(spaceContext.spaceState.spaceInfo!.startedAt).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [spaceContext?.spaceState.spaceInfo?.startedAt]);

  // Don't render if no active minimized space
  if (!spaceContext || !spaceContext.spaceState.isActive || !spaceContext.spaceState.isMinimized) {
    return null;
  }

  const { spaceState, leaveSpace, maximizeSpace, setMuted } = spaceContext;
  const canSpeak = spaceState.myRole === 'host' || spaceState.myRole === 'co_host' || spaceState.myRole === 'speaker';

  const handleMaximize = () => {
    maximizeSpace();
    const spaceId = spaceState.spaceInfo?.id;
    if (spaceId) {
      navigate(`/live/space/${spaceId}`, { state: { autoJoin: true, returningFromMinimize: true } });
    }
  };

  const handleToggleMute = () => {
    if (!canSpeak) return;
    setMuted(!spaceState.isMuted);
  };

  const handleLeave = () => {
    leaveSpace();
    navigate('/live');
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;
    
    const screenWidth = window.innerWidth;
    const widgetWidth = 200;
    
    const snappedX = newX < screenWidth / 2 - widgetWidth / 2 ? 16 : screenWidth - widgetWidth - 16;
    
    setPosition({
      x: snappedX,
      y: Math.max(50, Math.min(newY, window.innerHeight - 200)),
    });
  };

  return (
    <>
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
          <div className="bg-[#11131E]/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden w-52">
            {/* Content - clickable to expand */}
            <div 
              className="flex items-center gap-3 p-4 cursor-pointer"
              onClick={handleMaximize}
            >
              <div className="relative shrink-0">
                <Avatar className="w-12 h-12 border-2 border-purple-500">
                  <AvatarImage src={spaceState.spaceInfo?.hostAvatar || ''} />
                  <AvatarFallback className="bg-purple-500/20 text-purple-400">
                    {spaceState.spaceInfo?.hostName?.[0] || 'H'}
                  </AvatarFallback>
                </Avatar>
                {/* Green dot connection indicator */}
                <div className={cn(
                  "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#11131E]",
                  spaceState.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-white truncate">
                  {spaceState.spaceInfo?.title || 'Live Space'}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Live Session</p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="px-3 pb-3 flex items-center justify-between gap-2">
              {canSpeak ? (
                <button
                  onClick={handleToggleMute}
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                    spaceState.isMuted 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-green-500/20 text-green-400'
                  )}
                >
                  {spaceState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              ) : (
                <div className="h-8 w-8" />
              )}

              <button
                onClick={handleMaximize}
                className="h-8 w-8 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 flex items-center justify-center"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <button
                onClick={handleLeave}
                className="h-8 w-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default FloatingSpacePlayer;
