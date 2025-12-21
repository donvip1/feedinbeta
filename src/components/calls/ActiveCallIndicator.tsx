import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalCallContext } from '@/context/CallContext';
import { Phone, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ActiveCallIndicator: React.FC = () => {
  const callContext = useOptionalCallContext();
  const navigate = useNavigate();

  // Don't render if no active call or call is not minimized
  if (!callContext || !callContext.callState.isActive || !callContext.callState.isMinimized) {
    return null;
  }

  const { callState, maximizeCall } = callContext;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    maximizeCall();
    navigate(`/call?callId=${callState.callId}`);
  };

  return (
    <AnimatePresence>
      <motion.button
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        onClick={handleClick}
        className="fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white py-2 px-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-green-700 transition-colors safe-area-top"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
      >
        {callState.callType === 'video' ? (
          <Video className="w-4 h-4" />
        ) : (
          <Phone className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          Tap to return to call
        </span>
        <span className="text-sm font-mono bg-white/20 px-2 py-0.5 rounded">
          {formatDuration(callState.callDuration)}
        </span>
      </motion.button>
    </AnimatePresence>
  );
};

export default ActiveCallIndicator;
