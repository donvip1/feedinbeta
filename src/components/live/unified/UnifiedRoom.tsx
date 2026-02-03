import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Users, Heart, Gift, Share2, 
  Maximize2, Radio, Crown, Loader2, 
  ArrowLeft, MessageCircle, ChevronLeft, Minimize2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigation } from "@/context/NavigationContext";
import { useOptionalLiveStreamContext } from "@/context/LiveStreamContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Room,
  RoomEvent,
  VideoPresets,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
  RemoteTrack,
  createLocalVideoTrack,
  createLocalAudioTrack,
  ConnectionState,
} from "livekit-client";

import { AudioVisualizer } from "./AudioVisualizer";
import { PKBattleBar } from "./PKBattleBar";
import { UnifiedControlBar } from "./UnifiedControlBar";
import { FlyingChat } from "../FlyingChat";
import { FloatingReactions } from "../FloatingReactions";
import { LiveGiftModal } from "../LiveGiftModal";
import { UnifiedRoomProps, ChatMessage, Reaction, GiftAnimation } from "./types";

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️', like: '👍', laugh: '😂', fire: '🔥', clap: '👏', love: '😍', star: '⭐',
};

export const UnifiedRoom = ({ 
  room, 
  isHost, 
  isMinimized = false, 
  onClose, 
  onMinimize,
  onMaximize 
}: UnifiedRoomProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setHideBottomNav } = useNavigation();
  const streamContext = useOptionalLiveStreamContext();
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const challengerVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  
  // State
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('idle');
  const [isMuted, setIsMuted] = useState(!isHost);
  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [viewerCount, setViewerCount] = useState(room.viewers);
  const [comments, setComments] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [flyingGifts, setFlyingGifts] = useState<GiftAnimation[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [pkState, setPkState] = useState(room.pkData);
  const [hasVideo, setHasVideo] = useState(false);
  
  // Hide bottom nav when in room
  useEffect(() => {
    if (!isMinimized) {
      setHideBottomNav(true);
    }
    return () => setHideBottomNav(false);
  }, [isMinimized, setHideBottomNav]);
  
  // Initialize LiveKit for video modes
  const initializeLiveKit = useCallback(async () => {
    if (!user || (room.type === 'audio_space' && !isHost)) return;
    
    try {
      setConnectionStatus('connecting');
      
      // Get LiveKit token
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `stream-${room.id}`,
          participantName: user.user_metadata?.display_name || user.user_metadata?.username || (isHost ? 'Host' : 'Viewer'),
          participantIdentity: user.id,
          isHost,
        },
      });
      
      if (error || !data?.token) {
        throw new Error(data?.error || 'Failed to get LiveKit token');
      }
      
      // Create room
      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720,
        },
      });
      
      roomRef.current = lkRoom;
      
      // Event handlers
      lkRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) {
          setConnectionStatus('connected');
          if (isHost) {
            toast.success("You are now live!");
            // Update database
            supabase
              .from("live_streams")
              .update({ 
                status: "live",
                stream_ready: true,
                connection_state: "live",
                started_at: new Date().toISOString(),
              })
              .eq("id", room.id);
          }
        } else if (state === ConnectionState.Reconnecting) {
          setConnectionStatus('reconnecting');
        } else if (state === ConnectionState.Disconnected) {
          setConnectionStatus('error');
        }
      });
      
      lkRoom.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount(lkRoom.remoteParticipants.size + 1);
      });
      
      lkRoom.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount(lkRoom.remoteParticipants.size + 1);
      });
      
      // Track subscription for viewers
      lkRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setHasVideo(true);
        } else if (track.kind === Track.Kind.Audio) {
          const audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.muted = isMuted;
          track.attach(audioEl);
          document.body.appendChild(audioEl);
        }
      });
      
      lkRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
        if (track.kind === Track.Kind.Video) {
          setHasVideo(false);
        }
      });
      
      // Connect
      await lkRoom.connect(data.url, data.token);
      
      // Publish tracks if host
      if (isHost) {
        const videoTrack = await createLocalVideoTrack({
          facingMode: "user",
          resolution: VideoPresets.h720,
        });
        
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        
        videoTrackRef.current = videoTrack;
        audioTrackRef.current = audioTrack;
        
        if (videoRef.current) {
          videoTrack.attach(videoRef.current);
        }
        
        await lkRoom.localParticipant.publishTrack(videoTrack);
        await lkRoom.localParticipant.publishTrack(audioTrack);
        setHasVideo(true);
      }
      
    } catch (error: any) {
      console.error('[UnifiedRoom] LiveKit error:', error);
      setConnectionStatus('error');
      toast.error(error.message || 'Failed to connect');
    }
  }, [user, room.id, room.type, isHost, isMuted]);
  
  // Initialize on mount
  useEffect(() => {
    if (room.type !== 'audio_space') {
      initializeLiveKit();
    }
    
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
      document.querySelectorAll('audio').forEach(el => el.remove());
    };
  }, []);
  
  // Subscribe to comments
  useEffect(() => {
    const fetchComments = async () => {
      const { data: commentsData } = await supabase
        .from("live_stream_comments")
        .select("*")
        .eq("stream_id", room.id)
        .order("created_at", { ascending: true })
        .limit(100);
      
      if (!commentsData) return;
      
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setComments(commentsData.map(comment => ({
        id: comment.id,
        userId: comment.user_id,
        userName: profileMap.get(comment.user_id)?.display_name || profileMap.get(comment.user_id)?.username || 'Anonymous',
        userAvatar: profileMap.get(comment.user_id)?.avatar_url,
        content: comment.content,
        timestamp: new Date(comment.created_at),
      })));
    };
    
    fetchComments();
    
    const channel = supabase.channel(`unified-comments-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${room.id}`,
      }, async (payload) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();
        
        setComments(prev => [...prev, {
          id: payload.new.id,
          userId: payload.new.user_id,
          userName: profile?.display_name || profile?.username || 'Anonymous',
          userAvatar: profile?.avatar_url,
          content: payload.new.content,
          timestamp: new Date(payload.new.created_at),
        }]);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [room.id]);
  
  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase.channel(`unified-reactions-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${room.id}`,
      }, (payload: any) => {
        const newReaction: Reaction = {
          id: Date.now() + Math.random(),
          type: payload.new.reaction_type,
          emoji: REACTION_EMOJIS[payload.new.reaction_type] || '❤️',
          x: Math.random() * 40 + 55,
          y: Math.random() * 30 + 40,
        };
        setReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [room.id]);
  
  // Subscribe to gifts
  useEffect(() => {
    const channel = supabase.channel(`unified-gifts-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${room.id}`,
      }, async (payload: any) => {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", payload.new.sender_id)
          .single();
        
        const newGift: GiftAnimation = {
          id: payload.new.id,
          giftType: payload.new.gift_type,
          senderName: senderProfile?.display_name || senderProfile?.username || 'Someone',
          creditValue: payload.new.credit_value,
        };
        
        // Update PK score if in battle
        if (pkState && room.type === 'pk_battle') {
          const isForHost = payload.new.recipient_id === room.host.id;
          setPkState(prev => prev ? {
            ...prev,
            hostScore: isForHost ? prev.hostScore + payload.new.credit_value : prev.hostScore,
            challengerScore: !isForHost ? prev.challengerScore + payload.new.credit_value : prev.challengerScore,
          } : undefined);
        }
        
        setFlyingGifts(prev => [...prev, newGift]);
        setTimeout(() => {
          setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
        }, 5000);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [room.id, room.type, room.host.id, pkState]);
  
  // PK Battle timer
  useEffect(() => {
    if (room.type !== 'pk_battle' || !pkState || pkState.status !== 'active') return;
    
    const timer = setInterval(() => {
      setPkState(prev => {
        if (!prev || prev.timeLeft <= 0) {
          clearInterval(timer);
          return prev;
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [room.type, pkState?.status]);
  
  // Toggle handlers
  const handleMicToggle = useCallback(() => {
    if (audioTrackRef.current) {
      if (isMuted) {
        audioTrackRef.current.unmute();
      } else {
        audioTrackRef.current.mute();
      }
    }
    setIsMuted(!isMuted);
  }, [isMuted]);
  
  const handleCameraToggle = useCallback(() => {
    if (videoTrackRef.current) {
      if (isCameraOn) {
        videoTrackRef.current.mute();
      } else {
        videoTrackRef.current.unmute();
      }
    }
    setIsCameraOn(!isCameraOn);
  }, [isCameraOn]);
  
  const handleEndStream = useCallback(async () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    
    await supabase
      .from("live_streams")
      .update({ 
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", room.id);
    
    toast.success("Stream ended");
    onClose();
  }, [room.id, onClose]);
  
  const handleShare = useCallback(async () => {
    try {
      await navigator.share({
        title: room.title,
        text: `Watch ${room.host.name} live!`,
        url: `${window.location.origin}/live/stream/${room.id}`,
      });
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/live/stream/${room.id}`);
      toast.success("Link copied!");
    }
  }, [room]);
  
  // Minimized PiP view
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-24 right-4 z-50 w-40 aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border border-white/20"
        onClick={onMaximize}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-white">
            <Radio className="w-3 h-3 text-red-500" />
            LIVE
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </motion.div>
    );
  }
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-4 py-3"
      >
        <div className="flex items-center justify-between">
          {/* Host Info */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                // For hosts: minimize and navigate back, stream continues
                if (isHost && streamContext?.streamState.isActive) {
                  streamContext.minimizeStream();
                  navigate(-1);
                } else {
                  onClose();
                }
              }} 
              className="p-2 -ml-2"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="relative">
              <Avatar className="w-10 h-10 border-2 border-red-500">
                <AvatarImage src={room.host.avatar} alt={room.host.name} />
                <AvatarFallback>{room.host.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {room.host.level && (
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] font-bold px-1.5 rounded-full text-white">
                  {room.host.level}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{room.host.name}</p>
              <div className="flex items-center gap-1 text-xs text-white/70">
                <Users className="w-3 h-3" />
                <span>{viewerCount.toLocaleString()}</span>
              </div>
            </div>
            {!isHost && (
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white h-7 text-xs">
                Follow
              </Button>
            )}
          </div>
          
          {/* Minimize/Close Buttons */}
          <div className="flex items-center gap-2">
            {onMinimize && isHost && (
              <button 
                onClick={() => {
                  if (streamContext) {
                    streamContext.minimizeStream();
                  }
                  onMinimize();
                }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20"
              >
                <Minimize2 className="w-4 h-4 text-white" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* PK Battle Bar */}
      {room.type === 'pk_battle' && pkState && (
        <div className="absolute top-20 left-0 right-0 z-20">
          <PKBattleBar
            hostScore={pkState.hostScore}
            challengerScore={pkState.challengerScore}
            timeLeft={pkState.timeLeft}
            hostName={room.host.name}
            challengerName={pkState.challenger.name}
            hostAvatar={room.host.avatar}
            challengerAvatar={pkState.challenger.avatar}
          />
        </div>
      )}
      
      {/* Main Stage */}
      <div className="absolute inset-0">
        {room.type === 'pk_battle' && pkState ? (
          // Split Screen for PK Battle
          <div className="flex h-full">
            {/* Host Side (Blue) */}
            <div className="flex-1 relative bg-gradient-to-br from-blue-900 to-blue-600">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={!isHost && isMuted}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-bold text-lg">HOST</p>
                <p className="text-white/80 text-sm">{room.host.name}</p>
              </div>
            </div>
            
            {/* Center Divider */}
            <div className="w-1 bg-gradient-to-b from-yellow-400 via-white to-yellow-400 z-10" />
            
            {/* Challenger Side (Red) */}
            <div className="flex-1 relative bg-gradient-to-br from-red-600 to-red-900">
              <video
                ref={challengerVideoRef}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-red-900/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 right-4 text-right">
                <p className="text-white font-bold text-lg">CHALLENGER</p>
                <p className="text-white/80 text-sm">{pkState.challenger.name}</p>
              </div>
            </div>
          </div>
        ) : room.type === 'audio_space' ? (
          // Audio Space with Visualizer (Green Theme)
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-green-500/20 blur-3xl"
              />
              <motion.div
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.4, 0.2, 0.4],
                }}
                transition={{ duration: 5, repeat: Infinity }}
                className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl"
              />
            </div>
            
            {/* Center Content */}
            <div className="relative z-10 flex flex-col items-center">
              {/* Host Avatar with Pulse Effect */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative"
              >
                <Avatar className="w-28 h-28 border-4 border-green-400/50">
                  <AvatarImage src={room.host.avatar} alt={room.host.name} />
                  <AvatarFallback className="text-4xl bg-green-800">{room.host.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -inset-2 rounded-full border-2 border-green-400/40"
                />
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="absolute -inset-4 rounded-full border border-green-400/20"
                />
              </motion.div>
              
              {/* Visualizer */}
              <div className="mt-8">
                <AudioVisualizer active={connectionStatus === 'connected'} barCount={5} color="bg-white" />
              </div>
              
              {/* Title */}
              <h2 className="mt-6 text-xl font-bold text-white text-center px-8">
                {room.title}
              </h2>
              
              {/* Live Badge */}
              <motion.div
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="mt-4 flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full"
              >
                <Radio className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-400">LIVE AUDIO</span>
              </motion.div>
            </div>
          </div>
        ) : (
          // Standard Video Broadcast
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={!isHost && isMuted}
              className="w-full h-full object-cover"
            />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
            
            {/* Loading State */}
            {connectionStatus === 'connecting' && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
                  <p className="text-white">Connecting...</p>
                </div>
              </div>
            )}
            
            {/* No Video Fallback */}
            {!hasVideo && connectionStatus === 'connected' && !isHost && (
              <div className="absolute inset-0 bg-gradient-to-br from-pink-900/80 to-red-900/80 flex items-center justify-center">
                <div className="text-center">
                  <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-white/30">
                    <AvatarImage src={room.host.avatar} alt={room.host.name} />
                    <AvatarFallback>{room.host.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="text-white">Waiting for host...</p>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Floating Reactions */}
        <FloatingReactions reactions={reactions} />
        
        {/* Flying Chat */}
        {showChat && (
          <FlyingChat
            messages={comments.map(c => ({
              id: c.id,
              content: c.content,
              user_id: c.userId,
              created_at: c.timestamp.toISOString(),
              profiles: {
                display_name: c.userName,
                avatar_url: c.userAvatar,
              },
            }))}
            gifts={flyingGifts.map(g => ({
              id: g.id,
              gift_type: g.giftType,
              sender_name: g.senderName,
              credit_value: g.creditValue,
            }))}
            hostId={room.host.id}
          />
        )}
        
        {/* Right Side Floating Actions (TikTok Style) */}
        {!isHost && (
          <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4 z-20">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (!user) return toast.error("Please log in");
                supabase.from("live_stream_reactions").insert({
                  stream_id: room.id,
                  user_id: user.id,
                  reaction_type: 'heart',
                });
              }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-white mt-1">
                {reactions.length >= 1000 ? `${(reactions.length / 1000).toFixed(1)}K` : reactions.length || 0}
              </span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowChat(!showChat)}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-white mt-1">{comments.length}</span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowGiftModal(true)}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-white mt-1">Gift</span>
            </motion.button>
          </div>
        )}
      </div>
      
      {/* Control Bar */}
      <UnifiedControlBar
        roomType={room.type}
        isHost={isHost}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        streamId={room.id}
        hostId={room.host.id}
        streamTitle={room.title}
        onMicToggle={handleMicToggle}
        onCameraToggle={handleCameraToggle}
        onChatToggle={() => setShowChat(!showChat)}
        onGiftClick={() => setShowGiftModal(true)}
        onShareClick={handleShare}
        onEndStream={handleEndStream}
        onMinimize={onMinimize}
      />
      
      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={room.id}
        hostId={room.host.id}
        viewers={[]}
        isHost={isHost}
      />
    </div>
  );
};
