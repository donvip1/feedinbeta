import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, Minimize2, Maximize2 } from 'lucide-react';
import { callSounds } from '@/utils/callSounds';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface IncomingCallProps {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  callType: 'video' | 'voice';
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCall = ({
  callId,
  callerId,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onReject,
}: IncomingCallProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRinging, setIsRinging] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 100 });

  useEffect(() => {
    callSounds.reset();
    callSounds.playRinging();

    return () => {
      callSounds.stopAllSounds();
    };
  }, []);

  // Helper function to get or create conversation between two users
  const getOrCreateConversation = async (userId1: string, userId2: string): Promise<string | null> => {
    try {
      const { data: existingConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId1);
      
      if (existingConvs && existingConvs.length > 0) {
        for (const conv of existingConvs) {
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .eq('user_id', userId2)
            .maybeSingle();
          
          if (otherParticipant) {
            return conv.conversation_id;
          }
        }
      }

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ updated_at: new Date().toISOString() })
        .select()
        .single();

      if (convError || !newConv) return null;

      await supabase.from('conversation_participants').insert([
        { conversation_id: newConv.id, user_id: userId1 },
        { conversation_id: newConv.id, user_id: userId2 },
      ]);

      return newConv.id;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return null;
    }
  };

  // Insert call log message for declined calls
  const insertDeclinedCallLog = async () => {
    if (!user) return;
    
    try {
      const conversationId = await getOrCreateConversation(callerId, user.id);
      if (!conversationId) return;

      // Format: CALL_LOG:type:status:duration:isOutgoing (isOutgoing from receiver's perspective = false)
      const callLogContent = `CALL_LOG:${callType}:declined:0:false`;

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: callerId, // The caller initiated the call
        content: callLogContent,
        media_type: 'call_log',
      });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error inserting declined call log:', error);
    }
  };

  const handleAccept = async () => {
    setIsRinging(false);
    callSounds.stopAllSounds();
    
    try {
      console.log('[IncomingCall] Accepting call:', callId);
      
      // Update call status to answered FIRST and wait for it to complete
      const { error } = await supabase
        .from('call_logs')
        .update({ 
          status: 'answered',
          started_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) {
        console.error('[IncomingCall] Error updating call status:', error);
        throw error;
      }
      
      console.log('[IncomingCall] Call status updated to answered');
      
      // Verify the update was successful by polling
      let verified = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const { data } = await supabase
          .from('call_logs')
          .select('status')
          .eq('id', callId)
          .single();
        
        if (data?.status === 'answered') {
          verified = true;
          console.log('[IncomingCall] Call status verified as answered');
          break;
        }
      }
      
      if (!verified) {
        console.warn('[IncomingCall] Could not verify call status update, proceeding anyway');
      }

      onAccept();
      
      // Navigate to call page
      navigate(`/call?callId=${callId}&type=${callType}`);
    } catch (error) {
      console.error('[IncomingCall] Error accepting call:', error);
    }
  };

  const handleReject = async () => {
    setIsRinging(false);
    callSounds.stopAllSounds();
    callSounds.playDisconnected();
    
    try {
      // Update call status to rejected
      await supabase
        .from('call_logs')
        .update({ status: 'rejected', ended_at: new Date().toISOString() })
        .eq('id', callId);

      // Insert declined call log into conversation
      await insertDeclinedCallLog();

      onReject();
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
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
      y: Math.max(50, Math.min(newY, window.innerHeight - 250)),
    });
  };

  // Minimized floating widget version
  if (isMinimized) {
    return (
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
        <div className="bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900 rounded-2xl shadow-2xl border border-green-500/50 overflow-hidden backdrop-blur-xl w-52">
          {/* Pulse animation */}
          <div className="absolute inset-0 bg-green-500/10 animate-pulse rounded-2xl" />
          
          {/* Call info */}
          <div className="p-3 flex items-center gap-3 relative">
            <div className="relative">
              <Avatar className="w-12 h-12 border-2 border-green-500/50">
                <AvatarImage src={callerAvatar || ''} />
                <AvatarFallback className="bg-primary/20 text-primary text-lg">
                  {callerName[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{callerName}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Incoming {callType}
              </p>
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMinimized(false)}
              className="h-7 w-7 rounded-full bg-white/10"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="px-3 pb-3 flex items-center justify-center gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleReject}
              className="h-10 w-10 rounded-full bg-red-600 text-white hover:bg-red-700"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleAccept}
              className="h-12 w-12 rounded-full bg-green-600 text-white hover:bg-green-700 animate-pulse"
            >
              {callType === 'video' ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full screen version
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-md z-50 flex items-center justify-center p-6">
      {/* Minimize button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsMinimized(true)}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <Minimize2 className="w-5 h-5" />
      </Button>

      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="text-center space-y-10 max-w-md w-full relative z-10">
        {/* Caller Avatar with Ring Animation */}
        <div className="relative inline-block">
          {isRinging && (
            <>
              <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />
              <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping delay-300" />
            </>
          )}
          <Avatar className="w-36 h-36 border-4 border-primary shadow-2xl shadow-primary/50 relative">
            <AvatarImage src={callerAvatar || ''} />
            <AvatarFallback className="text-5xl bg-gradient-to-br from-purple-600 to-blue-600">
              {callerName[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Caller Info */}
        <div className="space-y-3">
          <h2 className="text-4xl font-bold text-white">{callerName}</h2>
          <p className="text-gray-300 text-xl flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Incoming {callType === 'video' ? 'video' : 'voice'} call
          </p>
        </div>

        {/* Call Action Buttons */}
        <div className="flex justify-center items-center gap-12 pt-12">
          {/* Reject Button */}
          <button
            onClick={handleReject}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-lg shadow-red-600/50">
              <PhoneOff className="w-9 h-9 text-white" />
            </div>
            <span className="text-sm text-gray-300 font-medium">Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-24 h-24 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-2xl shadow-green-600/50 animate-pulse">
              {callType === 'video' ? (
                <Video className="w-10 h-10 text-white" />
              ) : (
                <Phone className="w-10 h-10 text-white" />
              )}
            </div>
            <span className="text-sm text-gray-300 font-medium">Accept</span>
          </button>
        </div>

        {/* Ripple animation */}
        <style>{`
          @keyframes ping {
            75%, 100% {
              transform: scale(1.2);
              opacity: 0;
            }
          }
          .animate-ping {
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          .delay-300 {
            animation-delay: 300ms;
          }
        `}</style>
      </div>
    </div>
  );
};
