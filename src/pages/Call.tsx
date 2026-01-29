import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CallControls } from '@/components/calls/CallControls';
import { ConnectionStatus } from '@/components/calls/ConnectionStatus';
import { ShareCallModal } from '@/components/calls/ShareCallModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { callSounds } from '@/utils/callSounds';
import { useCallContext } from '@/context/CallContext';
import { Loader2, RefreshCw, UserPlus, Minimize2, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface CallData {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'video' | 'voice';
  status: string;
  caller_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  receiver_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const Call = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const {
    callState,
    startCall,
    endCall: contextEndCall,
    toggleMute: contextToggleMute,
    toggleVideo: contextToggleVideo,
    toggleSpeaker: contextToggleSpeaker,
    flipCamera: contextFlipCamera,
    startScreenShare: contextStartScreenShare,
    stopScreenShare: contextStopScreenShare,
    setLocalVideoRef,
    setRemoteVideoRef,
    setRemoteAudioRef,
  } = useCallContext();
  
  const callId = searchParams.get('callId');
  
  const [callData, setCallData] = useState<CallData | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'offline' | 'ended' | 'waiting_for_peer'>('connecting');
  const [otherUserProfile, setOtherUserProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [connectionMessage, setConnectionMessage] = useState('Starting call...');
  const [showRetry, setShowRetry] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isRemoteFullscreen, setIsRemoteFullscreen] = useState(false);
  const [currentCallType, setCurrentCallType] = useState<'video' | 'voice'>('voice');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasEndedRef = useRef(false);
  const setupCompleteRef = useRef(false);
  const callTypeRef = useRef<'video' | 'voice'>('voice');
  const callStatusSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ringingPollRef = useRef<NodeJS.Timeout | null>(null);

  const isCaller = callData?.caller_id === user?.id;

  // Sync video/audio refs with context
  useEffect(() => {
    if (localVideoRef.current) setLocalVideoRef(localVideoRef.current);
    if (remoteVideoRef.current) setRemoteVideoRef(remoteVideoRef.current);
    if (remoteAudioRef.current) setRemoteAudioRef(remoteAudioRef.current);
  }, [setLocalVideoRef, setRemoteVideoRef, setRemoteAudioRef]);

  // Monitor call state from context
  useEffect(() => {
    const status = callState.connectionStatus;
    
    if (status === 'connected' && callStatus !== 'connected') {
      callSounds.stopAllSounds();
      callSounds.playConnected();
      setCallStatus('connected');
      startTimer();
      setShowRetry(false);
      setConnectionMessage('Connected');
    } else if (status === 'waiting_for_peer') {
      setCallStatus('waiting_for_peer');
      setConnectionMessage('Waiting for other user to join...');
    } else if (status === 'ringing') {
      setCallStatus('ringing');
      setConnectionMessage('Ringing...');
    } else if (status === 'connecting') {
      if (callStatus !== 'connected' && callStatus !== 'waiting_for_peer') {
        setCallStatus('connecting');
        setConnectionMessage('Connecting...');
      }
    } else if (status === 'failed') {
      setShowRetry(true);
      setConnectionMessage('Connection failed - tap to retry');
    } else if (status === 'ended' || status === 'disconnected') {
      if (!hasEndedRef.current) {
        endCall();
      }
    }
  }, [callState.connectionStatus, callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  }, []);

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

  const insertCallLogMessage = async (status: 'answered' | 'missed' | 'declined', duration: number) => {
    if (!callData || !user) return;

    try {
      const conversationId = await getOrCreateConversation(callData.caller_id, callData.receiver_id);
      if (!conversationId) return;

      const callLogContent = `CALL_LOG:${callTypeRef.current}:${status}:${duration}:${isCaller}`;

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: callLogContent,
        media_type: 'call_log',
      });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error inserting call log message:', error);
    }
  };

  const endCall = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    console.log('[Call] Ending call');
    callSounds.stopAllSounds();
    callSounds.playDisconnected();
    setCallStatus('ended');
    
    // Clean up subscription
    if (callStatusSubscriptionRef.current) {
      await supabase.removeChannel(callStatusSubscriptionRef.current);
      callStatusSubscriptionRef.current = null;
    }
    
    try {
      const endTime = new Date().toISOString();
      const duration = startTimeRef.current 
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;

      const callLogStatus = callState.isConnected ? 'answered' : 'missed';

      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          ended_at: endTime,
          duration: duration,
        })
        .eq('id', callId);

      await insertCallLogMessage(callLogStatus, duration);

      if (callState.isConnected && duration > 0 && user?.id) {
        const durationMinutes = Math.max(1, Math.ceil(duration / 60));
        const action = callTypeRef.current === 'video' ? 'video_call' : 'voice_call';
        const otherUserName = otherUserProfile?.display_name || 'Unknown';
        
        try {
          await supabase.functions.invoke('credit-deduction', {
            body: {
              action,
              callId: callId,
              metadata: {
                minutes: durationMinutes,
                duration: duration,
                otherUserName: otherUserName,
              },
            },
          });

          const costPerMinute = callTypeRef.current === 'video' ? 30 : 20;
          const totalCost = costPerMinute * durationMinutes;
          
          toast({
            title: 'Call ended',
            description: `Duration: ${formatDuration(duration)}. ${totalCost} credits deducted.`,
          });
        } catch (creditError) {
          console.error('Credit deduction error:', creditError);
        }
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    await contextEndCall();

    setTimeout(() => {
      navigate('/messages');
    }, 1500);
  }, [callId, callState.isConnected, user?.id, toast, navigate, callData, isCaller, contextEndCall]);

  const retryConnection = useCallback(async () => {
    if (!callData || !user) return;
    
    setShowRetry(false);
    setConnectionMessage('Retrying connection...');
    setupCompleteRef.current = false;
    
    await contextEndCall();
    await setupCall(callData);
  }, [callData, user, contextEndCall]);

  useEffect(() => {
    if (user === undefined) return;
    
    if (!callId) {
      toast({
        title: 'Invalid call',
        description: 'No call ID provided',
        variant: 'destructive',
      });
      navigate('/messages');
      return;
    }

    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to make calls',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    callSounds.reset();
    loadCallData();

    return () => {
      callSounds.stopAllSounds();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (callStatusSubscriptionRef.current) {
        supabase.removeChannel(callStatusSubscriptionRef.current);
      }
      if (ringingPollRef.current) {
        clearInterval(ringingPollRef.current);
        ringingPollRef.current = null;
      }
    };
  }, [callId, user]);

  const loadCallData = async () => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;

      callTypeRef.current = data.call_type as 'video' | 'voice';
      setCurrentCallType(data.call_type as 'video' | 'voice');
      const [callerProfile, receiverProfile] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('id', data.caller_id).single(),
        supabase.from('profiles').select('display_name, avatar_url').eq('id', data.receiver_id).single(),
      ]);

      const callDataWithProfiles: CallData = {
        id: data.id,
        caller_id: data.caller_id,
        receiver_id: data.receiver_id,
        call_type: data.call_type as 'video' | 'voice',
        status: data.status,
        caller_profile: callerProfile.data,
        receiver_profile: receiverProfile.data,
      };

      setCallData(callDataWithProfiles);
      
      const otherProfile = data.caller_id === user?.id 
        ? receiverProfile.data 
        : callerProfile.data;
      setOtherUserProfile(otherProfile);

      // Set up realtime subscription FIRST before checking status
      subscribeToCallUpdates(callDataWithProfiles);

      if (data.status === 'ended' || data.status === 'rejected') {
        toast({
          title: 'Call unavailable',
          description: 'This call has already ended.',
        });
        navigate('/messages');
        return;
      }

      // Handle different call states
      if (data.caller_id === user?.id && data.status === 'pending') {
        // Caller waiting for receiver to answer - DON'T connect to LiveKit yet
        setCallStatus('ringing');
        setConnectionMessage('Ringing...');
        callSounds.playRinging();
        
        // Poll-based fallback to check if call was answered (backup for realtime)
        ringingPollRef.current = setInterval(async () => {
          try {
            const { data: updatedCall } = await supabase
              .from('call_logs')
              .select('status')
              .eq('id', callId)
              .single();
            
            console.log('[Call] Poll check - call status:', updatedCall?.status);
            
            if (updatedCall?.status === 'answered' && !setupCompleteRef.current) {
              console.log('[Call] Call answered detected via poll');
              if (ringingPollRef.current) {
                clearInterval(ringingPollRef.current);
                ringingPollRef.current = null;
              }
              callSounds.stopRinging();
              setCallStatus('connecting');
              setConnectionMessage('Connecting...');
              await setupCall(callDataWithProfiles);
            } else if (updatedCall?.status === 'ended' || updatedCall?.status === 'rejected') {
              console.log('[Call] Call ended/rejected detected via poll');
              if (ringingPollRef.current) {
                clearInterval(ringingPollRef.current);
                ringingPollRef.current = null;
              }
              if (!hasEndedRef.current) {
                endCall();
              }
            }
          } catch (error) {
            console.error('[Call] Error polling call status:', error);
          }
        }, 2000);
        
        // Set timeout for unanswered calls
        const ringingTimeout = setTimeout(() => {
          if (!hasEndedRef.current && callStatus === 'ringing') {
            console.log('[Call] Call not answered within 60 seconds');
            if (ringingPollRef.current) {
              clearInterval(ringingPollRef.current);
              ringingPollRef.current = null;
            }
            toast({
              title: 'No Answer',
              description: 'The call was not answered.',
            });
            endCall();
          }
        }, 60000);
        
        return () => {
          clearTimeout(ringingTimeout);
          if (ringingPollRef.current) {
            clearInterval(ringingPollRef.current);
            ringingPollRef.current = null;
          }
        };
      } else if (data.receiver_id === user?.id && data.status === 'pending') {
        // Receiver sees pending call - should be handled by IncomingCall component
        // This shouldn't happen normally, but redirect to messages if it does
        navigate('/messages');
        return;
      } else if (data.status === 'answered') {
        // Call already answered - connect to LiveKit
        setCallStatus('connecting');
        setConnectionMessage('Connecting...');
        await setupCall(callDataWithProfiles);
      }
    } catch (error: any) {
      console.error('Error loading call:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call data',
        variant: 'destructive',
      });
      navigate('/messages');
    }
  };

  const subscribeToCallUpdates = (data: CallData) => {
    // Clean up existing subscription
    if (callStatusSubscriptionRef.current) {
      supabase.removeChannel(callStatusSubscriptionRef.current);
    }

    console.log('[Call] Subscribing to call updates for:', callId);

    callStatusSubscriptionRef.current = supabase
      .channel(`call-page-${callId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          const newStatus = payload.new.status;
          const newCallType = payload.new.call_type as 'video' | 'voice';
          console.log('[Call] Call status updated:', newStatus, 'setupComplete:', setupCompleteRef.current);
          
          if (newStatus === 'ended' || newStatus === 'rejected') {
            if (!hasEndedRef.current) {
              console.log('[Call] Call ended/rejected by other party');
              callSounds.stopAllSounds();
              callSounds.playDisconnected();
              setCallStatus('ended');
              
              // Navigate immediately
              setTimeout(() => {
                navigate('/messages');
              }, 1000);
            }
          } else if (newStatus === 'answered' && !setupCompleteRef.current) {
            // CRITICAL: When call is answered, BOTH parties should now connect to LiveKit
            const updatedCallData: CallData = {
              id: payload.new.id,
              caller_id: payload.new.caller_id,
              receiver_id: payload.new.receiver_id,
              call_type: newCallType,
              status: newStatus,
              caller_profile: data.caller_profile,
              receiver_profile: data.receiver_profile,
            };
            
            console.log('[Call] Call answered - connecting to LiveKit');
            callSounds.stopRinging();
            setCallStatus('connecting');
            setConnectionMessage('Connecting...');
            
            // Small delay to ensure database is fully synced
            await new Promise(resolve => setTimeout(resolve, 200));
            await setupCall(updatedCallData);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Call] Subscription status:', status);
      });
  };

  const setupCall = async (data: CallData) => {
    if (setupCompleteRef.current) {
      console.log('[Call] Setup already complete, skipping');
      return;
    }
    
    setupCompleteRef.current = true;

    const otherUserId = data.caller_id === user?.id ? data.receiver_id : data.caller_id;
    const isVideo = callTypeRef.current === 'video';
    const isCaller = data.caller_id === user?.id;

    console.log('[Call] Setting up LiveKit call');
    console.log('[Call] Call type:', isVideo ? 'video' : 'voice');
    console.log('[Call] Role:', isCaller ? 'CALLER' : 'RECEIVER');
    console.log('[Call] Other user:', otherUserId);

    try {
      await startCall(
        callId!,
        isVideo ? 'video' : 'voice',
        otherUserId,
        isCaller
      );
      
      console.log('[Call] LiveKit call setup initiated successfully');
    } catch (error: any) {
      console.error('[Call] Error setting up call:', error);
      setupCompleteRef.current = false;
      setShowRetry(true);
      toast({
        title: 'Connection Error',
        description: error.message || 'Failed to establish call connection. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleMute = () => {
    contextToggleMute();
  };

  const handleToggleVideo = () => {
    contextToggleVideo();
  };

  const handleToggleSpeaker = () => {
    contextToggleSpeaker();
    toast({
      title: callState.isSpeakerOn ? 'Speaker Off' : 'Speaker On',
      description: callState.isSpeakerOn ? 'Switched to earpiece' : 'Switched to loudspeaker',
    });
  };

  const handleFlipCamera = async () => {
    await contextFlipCamera();
  };

  const handleToggleScreenShare = async () => {
    if (callState.isScreenSharing) {
      await contextStopScreenShare();
    } else {
      await contextStartScreenShare();
    }
  };

  // Upgrade from voice to video call
  const handleUpgradeToVideo = useCallback(async () => {
    if (currentCallType === 'video') return;
    
    try {
      // Enable the camera
      await contextToggleVideo();
      
      // Update local state
      callTypeRef.current = 'video';
      setCurrentCallType('video');
      
      // Update database
      if (callId) {
        await supabase
          .from('call_logs')
          .update({ call_type: 'video' })
          .eq('id', callId);
      }
      
      toast({
        title: 'Video enabled',
        description: 'Switched to video call',
      });
    } catch (error) {
      console.error('Error upgrading to video:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable video',
        variant: 'destructive',
      });
    }
  }, [currentCallType, callId, contextToggleVideo, toast]);

  // Toggle remote video fullscreen
  const toggleRemoteFullscreen = () => {
    setIsRemoteFullscreen(prev => !prev);
  };

  if (!callData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isVideoCall = currentCallType === 'video';
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 text-white flex flex-col relative overflow-hidden">
      {/* Hidden audio element for voice calls - with explicit attributes */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline
        style={{ display: 'none' }}
      />
      
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Network Quality Indicator and Invite Button - shown when connected */}
      {callState.isConnected && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={() => setShowShareModal(true)}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Invite
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-full border border-green-500/30">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Connected</span>
          </div>
        </div>
      )}

      {/* Connection Status Overlay */}
      {(callStatus === 'connecting' || callStatus === 'waiting_for_peer' || callStatus === 'ringing') && !callState.isConnected && (
        <div className="absolute top-4 left-4 right-20 z-20">
          <ConnectionStatus 
            status={callState.connectionStatus || 'connecting'}
            message={connectionMessage}
            showRetry={showRetry}
            onRetry={retryConnection}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {isVideoCall ? (
          /* Video call layout */
          <div className="w-full h-full flex flex-col items-center relative">
            {/* Remote video (main view) - Tap to toggle fullscreen */}
            <motion.div 
              className={`relative bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden shadow-2xl cursor-pointer transition-all duration-300 ${
                isRemoteFullscreen 
                  ? 'fixed inset-0 z-50 rounded-none' 
                  : 'w-full max-w-2xl aspect-video rounded-3xl'
              }`}
              onClick={toggleRemoteFullscreen}
              layout
            >
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              {/* Fullscreen toggle button overlay */}
              <div className="absolute top-4 right-4 opacity-0 hover:opacity-100 transition-opacity">
                <button 
                  className="p-2 bg-black/50 rounded-full text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRemoteFullscreen();
                  }}
                >
                  {isRemoteFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </div>

              {/* Tap hint - show briefly */}
              {callState.isConnected && !isRemoteFullscreen && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1.5 rounded-full text-xs text-white/70 pointer-events-none">
                  Tap to fullscreen
                </div>
              )}
              
              {/* Close button when fullscreen */}
              {isRemoteFullscreen && (
                <button 
                  className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRemoteFullscreen(false);
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {!callState.isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Avatar className="w-24 h-24 border-4 border-primary shadow-xl">
                    <AvatarImage src={otherUserProfile?.avatar_url || ''} />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-pink-600 to-rose-600">
                      {otherUserProfile?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-lg text-gray-300">{otherUserProfile?.display_name || 'Unknown User'}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {callStatus === 'ringing' ? 'Ringing...' : callStatus === 'waiting_for_peer' ? 'Waiting for user...' : 'Connecting...'}
                  </div>
                </div>
              )}
            </motion.div>
            
            {/* Local video (picture-in-picture) - Draggable style */}
            <AnimatePresence>
              {!isRemoteFullscreen && (
                <motion.div 
                  className="absolute top-8 right-8 w-28 h-40 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover ${callState.isVideoOff ? 'hidden' : ''}`}
                  />
                  {callState.isVideoOff && (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <span className="text-gray-400 text-xs">Camera off</span>
                    </div>
                  )}
                  {callState.isScreenSharing && (
                    <div className="absolute bottom-1 left-1 right-1 bg-primary/80 text-xs text-center py-0.5 rounded">
                      Sharing
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Minimized local video when fullscreen */}
            {isRemoteFullscreen && (
              <motion.div 
                className="fixed bottom-24 right-4 w-24 h-32 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 z-50"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover ${callState.isVideoOff ? 'hidden' : ''}`}
                />
                {callState.isVideoOff && (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <span className="text-gray-400 text-xs">Off</span>
                  </div>
                )}
              </motion.div>
            )}
            
            {/* Call info - hide when fullscreen */}
            {!isRemoteFullscreen && (
              <div className="mt-6 text-center">
                <h2 className="text-2xl font-bold">{otherUserProfile?.display_name || 'Unknown User'}</h2>
                <p className="text-lg text-gray-300 mt-2">
                  {callStatus === 'connected' ? (
                    <span className="text-green-400">{formatDuration(callDuration)}</span>
                  ) : callStatus === 'ended' ? (
                    <span className="text-gray-400">Call ended</span>
                  ) : null}
                </p>
              </div>
            )}

            {/* Fullscreen call info overlay */}
            {isRemoteFullscreen && callState.isConnected && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/50 px-4 py-2 rounded-full flex items-center gap-3">
                <span className="text-white font-medium">{otherUserProfile?.display_name || 'Unknown'}</span>
                <span className="text-green-400 font-mono">{formatDuration(callDuration)}</span>
              </div>
            )}
          </div>
        ) : (
          /* Voice call layout */
          <div className="flex flex-col items-center justify-center gap-8">
            <div className="relative">
              {(callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'waiting_for_peer') && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-primary/50 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" style={{ animationDelay: '300ms' }} />
                </>
              )}
              {callState.isConnected && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
              )}
              <Avatar className="w-40 h-40 border-8 border-primary/30 shadow-2xl shadow-primary/20 relative">
                <AvatarImage src={otherUserProfile?.avatar_url || ''} />
                <AvatarFallback className="text-5xl bg-gradient-to-br from-pink-600 to-rose-600">
                  {otherUserProfile?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">{otherUserProfile?.display_name || 'Unknown User'}</h2>
              <p className="text-lg text-gray-300">
                {callStatus === 'offline' && (
                  <span className="flex items-center justify-center gap-2 text-red-400">
                    <span className="w-2 h-2 bg-red-400 rounded-full" />
                    User is offline
                  </span>
                )}
                {callStatus === 'connecting' && (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </span>
                )}
                {callStatus === 'waiting_for_peer' && (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for user to join...
                  </span>
                )}
                {callStatus === 'ringing' && (
                  <span className="flex items-center justify-center gap-2 text-primary">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    Ringing...
                  </span>
                )}
                {callStatus === 'connected' && (
                  <span className="text-green-400 text-2xl font-mono">{formatDuration(callDuration)}</span>
                )}
                {callStatus === 'ended' && (
                  <span className="text-gray-400">Call ended</span>
                )}
              </p>
              
              {showRetry && callStatus !== 'connected' && callStatus !== 'ended' && (
                <Button
                  onClick={retryConnection}
                  variant="outline"
                  className="mt-4 border-primary/50 text-primary hover:bg-primary/20"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Connection
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Call controls - Fixed at bottom when fullscreen */}
      <div className={`relative z-10 p-6 pb-10 bg-gradient-to-t from-black/50 to-transparent ${isRemoteFullscreen ? 'fixed bottom-0 left-0 right-0 z-50' : ''}`}>
        <CallControls
          isMuted={callState.isMuted}
          isVideoOff={callState.isVideoOff}
          isSpeakerOn={callState.isSpeakerOn}
          isVideoCall={isVideoCall}
          isScreenSharing={callState.isScreenSharing}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleSpeaker={handleToggleSpeaker}
          onEndCall={endCall}
          onFlipCamera={isVideoCall && isMobileDevice ? handleFlipCamera : undefined}
          onToggleScreenShare={!isMobileDevice ? handleToggleScreenShare : undefined}
          onUpgradeToVideo={!isVideoCall ? handleUpgradeToVideo : undefined}
        />
      </div>

      {/* Share Call Modal */}
      <ShareCallModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        callId={callId || ''}
        callType={callTypeRef.current}
      />
    </div>
  );
};

export default Call;
