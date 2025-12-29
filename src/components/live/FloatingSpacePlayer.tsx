import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalSpaceContext } from '@/context/SpaceContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Maximize2, Radio, Users } from 'lucide-react';
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
    // Navigate to the space - use spaceId directly for proper routing
    const spaceId = spaceState.spaceInfo?.id;
    if (spaceId) {
      navigate(`/space/${spaceId}`);
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
    
    // Snap to edges
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
          <div className="bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900 rounded-2xl shadow-2xl border border-primary/30 overflow-hidden backdrop-blur-xl w-52">
            {/* Header with pulsing live indicator */}
            <div className="px-3 py-2 flex items-center gap-2 bg-black/20">
              <div className="relative">
                <Radio className="w-4 h-4 text-red-500" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
              </div>
              <span className="text-xs font-medium text-white/80 truncate flex-1">
                {spaceState.spaceInfo?.title || 'Live Space'}
              </span>
              <span className="text-xs text-primary">{duration}</span>
            </div>

            {/* Host info */}
            <div className="p-3 flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10 border-2 border-primary/50">
                  <AvatarImage src={spaceState.spaceInfo?.hostAvatar || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {spaceState.spaceInfo?.hostName?.[0] || 'H'}
                  </AvatarFallback>
                </Avatar>
                {/* Audio wave indicator */}
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                  spaceState.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'
                )}>
                  <Users className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {spaceState.spaceInfo?.hostName || 'Host'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {spaceState.myRole === 'host' ? 'Hosting' : 
                   spaceState.myRole === 'co_host' ? 'Co-hosting' :
                   spaceState.myRole === 'speaker' ? 'Speaking' : 'Listening'}
                </p>
              </div>
            </div>

            {/* Control buttons */}
            <div className="px-3 pb-3 flex items-center justify-between gap-2">
              {canSpeak ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleToggleMute}
                  className={cn(
                    "h-8 w-8 rounded-full",
                    spaceState.isMuted 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-green-500/20 text-green-400'
                  )}
                >
                  {spaceState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              ) : (
                <div className="h-8 w-8" /> // Placeholder for listeners
              )}

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
                onClick={handleLeave}
                className="h-8 w-8 rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default FloatingSpacePlayer;
