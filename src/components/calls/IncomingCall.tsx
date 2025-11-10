import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';

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
  const [isRinging, setIsRinging] = useState(true);

  useEffect(() => {
    // Play ringtone sound
    const audio = new Audio('/sounds/ringtone.mp3');
    audio.loop = true;
    audio.play().catch((e) => console.error('Error playing ringtone:', e));

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const handleAccept = async () => {
    setIsRinging(false);
    
    try {
      // Update call status to answered
      await supabase
        .from('call_logs')
        .update({ status: 'answered' })
        .eq('id', callId);

      onAccept();
      
      // Navigate to call page
      navigate(`/call?callId=${callId}&type=${callType}`);
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const handleReject = async () => {
    setIsRinging(false);
    
    try {
      // Update call status to rejected
      await supabase
        .from('call_logs')
        .update({ status: 'rejected', ended_at: new Date().toISOString() })
        .eq('id', callId);

      onReject();
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-md w-full">
        {/* Caller Avatar with Ring Animation */}
        <div className="relative inline-block">
          <div className={`absolute inset-0 rounded-full border-4 border-primary ${isRinging ? 'animate-ping' : ''}`} />
          <Avatar className="w-32 h-32 border-4 border-primary relative">
            <AvatarImage src={callerAvatar || ''} />
            <AvatarFallback className="text-4xl bg-gray-800">
              {callerName[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Caller Info */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">{callerName}</h2>
          <p className="text-gray-400 text-lg">
            Incoming {callType === 'video' ? 'video' : 'voice'} call...
          </p>
        </div>

        {/* Call Action Buttons */}
        <div className="flex justify-center items-center space-x-8 pt-8">
          {/* Reject Button */}
          <button
            onClick={handleReject}
            className="flex flex-col items-center space-y-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all group-hover:scale-110">
              <PhoneOff className="w-8 h-8 text-white" />
            </div>
            <span className="text-sm text-gray-400">Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            className="flex flex-col items-center space-y-2 group"
          >
            <div className="w-20 h-20 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-lg shadow-green-600/50">
              {callType === 'video' ? (
                <Video className="w-10 h-10 text-white" />
              ) : (
                <Phone className="w-10 h-10 text-white" />
              )}
            </div>
            <span className="text-sm text-white font-medium">Accept</span>
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
        `}</style>
      </div>
    </div>
  );
};