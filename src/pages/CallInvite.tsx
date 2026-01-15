import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, Video, X, Loader2, Clock, UserX } from 'lucide-react';
import { callSounds } from '@/utils/callSounds';

interface InviteData {
  id: string;
  call_id: string;
  invite_code: string;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  call_type: 'video' | 'voice';
  creator_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const CallInvite = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    loadInviteData();
  }, [inviteCode]);

  const loadInviteData = async () => {
    try {
      // Fetch invite data without auth check first (allow anyone to see invite info)
      const { data: invite, error: inviteError } = await supabase
        .from('call_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (inviteError || !invite) {
        console.error('[CallInvite] Invite not found:', inviteError);
        setError('Invite not found or has expired');
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(invite.expires_at) < new Date()) {
        setError('This invite has expired');
        setLoading(false);
        return;
      }

      // Load creator's profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', invite.created_by)
        .single();

      // Check if the call is still active (not ended)
      if (invite.call_id) {
        const { data: callLog } = await supabase
          .from('call_logs')
          .select('status, call_type')
          .eq('id', invite.call_id)
          .maybeSingle();

        // Only reject if call has explicitly ended or was rejected
        if (callLog?.status === 'ended' || callLog?.status === 'rejected') {
          setError('This call has ended');
          setLoading(false);
          return;
        }
      }

      // Get call_type from invite first (new system), fallback to call_logs (old system)
      let callType: 'video' | 'voice' = (invite.call_type as 'video' | 'voice') || 'video';
      
      // If invite doesn't have call_type, check call_logs
      if (!invite.call_type && invite.call_id) {
        const { data: callLog } = await supabase
          .from('call_logs')
          .select('call_type')
          .eq('id', invite.call_id)
          .maybeSingle();
        if (callLog?.call_type) {
          callType = callLog.call_type as 'video' | 'voice';
        }
      }

      setInviteData({
        ...invite,
        creator_profile: creatorProfile || undefined,
        call_type: callType,
      });
      setLoading(false);

      // Play ringing sound
      callSounds.reset();
      callSounds.playRinging();

    } catch (err: any) {
      console.error('[CallInvite] Error loading invite:', err);
      setError('Failed to load invite');
      setLoading(false);
    }
  };

  const handleJoinCall = async () => {
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=/call/join/${inviteCode}`);
      return;
    }

    if (!inviteData) return;

    setJoining(true);
    callSounds.stopAllSounds();

    try {
      // Mark invite as used (don't fail if already used - allow rejoin)
      await supabase
        .from('call_invites')
        .update({
          used_at: new Date().toISOString(),
          used_by: user.id,
        })
        .eq('id', inviteData.id);

      // Check call status and update if needed
      const { data: existingCall } = await supabase
        .from('call_logs')
        .select('status')
        .eq('id', inviteData.call_id)
        .single();

      if (existingCall) {
        // If call is pending or in progress, update to answered
        if (existingCall.status === 'pending' || existingCall.status === 'answered') {
          await supabase
            .from('call_logs')
            .update({
              status: 'answered',
              started_at: existingCall.status === 'pending' ? new Date().toISOString() : undefined,
            })
            .eq('id', inviteData.call_id);
        }
      }

      // Navigate to call page
      navigate(`/call?callId=${inviteData.call_id}&type=${inviteData.call_type}`);

    } catch (err: any) {
      console.error('[CallInvite] Error joining call:', err);
      toast({
        title: 'Failed to join call',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
      setJoining(false);
    }
  };

  const handleDecline = () => {
    callSounds.stopAllSounds();
    callSounds.playDisconnected();
    navigate('/');
  };

  useEffect(() => {
    return () => {
      callSounds.stopAllSounds();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            {error.includes('expired') ? (
              <Clock className="w-10 h-10 text-red-400" />
            ) : (
              <UserX className="w-10 h-10 text-red-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{error}</h1>
          <p className="text-gray-400">
            The call invite link is no longer valid. Please ask for a new invite.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!inviteData) return null;

  const creatorName = inviteData.creator_profile?.display_name || 'Someone';
  const isVideoCall = inviteData.call_type === 'video';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="text-center space-y-10 max-w-md w-full relative z-10">
        {/* Caller Avatar with Ring Animation */}
        <div className="relative inline-block">
          <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping delay-300" />
          <Avatar className="w-36 h-36 border-4 border-primary shadow-2xl shadow-primary/50 relative">
            <AvatarImage src={inviteData.creator_profile?.avatar_url || ''} />
            <AvatarFallback className="text-5xl bg-gradient-to-br from-purple-600 to-blue-600">
              {creatorName[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Caller Info */}
        <div className="space-y-3">
          <h2 className="text-4xl font-bold text-white">{creatorName}</h2>
          <p className="text-gray-300 text-xl flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            {isVideoCall ? 'Video' : 'Voice'} call invitation
          </p>
          {!user && (
            <p className="text-sm text-gray-400">
              Sign in to join this call
            </p>
          )}
        </div>

        {/* Call Action Buttons */}
        <div className="flex justify-center items-center gap-12 pt-8">
          {/* Decline Button */}
          <button
            onClick={handleDecline}
            className="flex flex-col items-center gap-3 group"
            disabled={joining}
          >
            <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-lg shadow-red-600/50">
              <X className="w-9 h-9 text-white" />
            </div>
            <span className="text-sm text-gray-300 font-medium">Decline</span>
          </button>

          {/* Join Button */}
          <button
            onClick={handleJoinCall}
            className="flex flex-col items-center gap-3 group"
            disabled={joining}
          >
            <div className="w-24 h-24 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-all group-hover:scale-110 shadow-2xl shadow-green-600/50 animate-pulse">
              {joining ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : isVideoCall ? (
                <Video className="w-10 h-10 text-white" />
              ) : (
                <Phone className="w-10 h-10 text-white" />
              )}
            </div>
            <span className="text-sm text-gray-300 font-medium">
              {user ? 'Join Call' : 'Sign In & Join'}
            </span>
          </button>
        </div>
      </div>

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
        .delay-1000 {
          animation-delay: 1000ms;
        }
      `}</style>
    </div>
  );
};

export default CallInvite;