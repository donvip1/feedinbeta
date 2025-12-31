import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Video, VideoOff, Mic, MicOff, FlipHorizontal,
  Users, Send, X, Gift, MessageCircle,
  Maximize, Minimize, Radio, UserPlus, Coins, Share2, Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { useNavigation } from '@/context/NavigationContext';
import { useNavigate } from 'react-router-dom';
import { FlyingChat } from './FlyingChat';
import { ViewerListPanel } from './ViewerListPanel';
import { motion, AnimatePresence } from "framer-motion";

interface LiveBroadcasterProps {
  streamId: string;
  onClose: () => void;
}

// Reaction emojis
const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️',
  like: '👍',
  laugh: '😂',
  fire: '🔥',
  clap: '👏',
  love: '😍',
  star: '⭐',
};

export const LiveBroadcaster = ({ streamId, onClose }: LiveBroadcasterProps) => {
  const { user } = useAuth();
  const { setHideBottomNav } = useNavigation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [reactions, setReactions] = useState<{ type: string; id: number; x: number; y: number; senderName?: string }[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [totalGiftsReceived, setTotalGiftsReceived] = useState(0);
  const [flyingGifts, setFlyingGifts] = useState<{ id: string; gift_type: string; sender_name: string; credit_value: number }[]>([]);
  const [coHosts, setCoHosts] = useState<string[]>([]);

  // Hide bottom navigation when broadcasting
  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  // Initialize media stream
  const initializeMedia = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      return mediaStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  };

  // Start broadcasting
  const startBroadcast = async () => {
    setIsStarting(true);
    try {
      await initializeMedia();
      
      // Update stream status to live
      const { error } = await supabase
        .from("live_streams")
        .update({ 
          status: "live",
          started_at: new Date().toISOString(),
        })
        .eq("id", streamId);

      if (error) throw error;

      setIsLive(true);
      toast.success("You are now live!");
    } catch (error: any) {
      console.error("Error starting broadcast:", error);
      toast.error(error.message || "Failed to start broadcast");
    } finally {
      setIsStarting(false);
    }
  };

  // Stop broadcasting
  const stopBroadcast = async () => {
    // Send stream-ended broadcast to all viewers FIRST
    const endChannel = supabase.channel(`broadcast-${streamId}-end`);
    await endChannel.subscribe();
    await supabase.channel(`broadcast-${streamId}`).send({
      type: 'broadcast',
      event: 'stream-ended',
      payload: { streamId },
    });
    
    // Give viewers a moment to receive the message
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Stop all tracks
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    // Close all peer connections
    viewersRef.current.forEach(pc => pc.close());
    viewersRef.current.clear();

    // Update stream status
    await supabase
      .from("live_streams")
      .update({ 
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", streamId);

    await supabase.removeChannel(endChannel);
    setIsLive(false);
    onClose();
  };

  // Toggle video
  const toggleVideo = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  // Switch camera - update all viewer connections
  const switchCamera = async () => {
    const oldStream = streamRef.current;
    setIsFrontCamera(!isFrontCamera);
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: !isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Replace tracks in all viewer peer connections
      const newVideoTrack = newStream.getVideoTracks()[0];
      const newAudioTrack = newStream.getAudioTracks()[0];

      viewersRef.current.forEach((pc, viewerId) => {
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === 'video' && newVideoTrack) {
            sender.replaceTrack(newVideoTrack).catch(err => {
              console.error(`[Host] Error replacing video track for ${viewerId}:`, err);
            });
          } else if (sender.track?.kind === 'audio' && newAudioTrack) {
            sender.replaceTrack(newAudioTrack).catch(err => {
              console.error(`[Host] Error replacing audio track for ${viewerId}:`, err);
            });
          }
        });
      });

      // Stop old tracks
      oldStream?.getTracks().forEach(track => track.stop());
      
      console.log("[Host] Camera switched and tracks updated for all viewers");
    } catch (error) {
      console.error("[Host] Error switching camera:", error);
      toast.error("Could not switch camera");
    }
  };

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("id", streamId)
        .single();

      if (!error && data) {
        setStream(data);
      }
    };

    fetchStream();
  }, [streamId]);

  // Subscribe to signaling channel for viewer connections
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel(`broadcast-${streamId}`, {
        config: {
          broadcast: { self: false },
        }
      })
      .on('broadcast', { event: 'viewer-join' }, async ({ payload }) => {
        console.log("[Host] Viewer joining:", payload.viewerId);
        await handleViewerJoin(payload.viewerId, channel);
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        const pc = viewersRef.current.get(payload.viewerId);
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error("[Host] Error adding ICE candidate:", err);
          }
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        const pc = viewersRef.current.get(payload.viewerId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            console.log("[Host] Received answer from viewer:", payload.viewerId);
          } catch (err) {
            console.error("[Host] Error setting remote description:", err);
          }
        }
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("[Host] Subscribed to broadcast channel");
        // Signal to any waiting viewers that host is ready
        channel.send({
          type: 'broadcast',
          event: 'host-ready',
          payload: { streamId },
        });
        
        // Send host-ready signal periodically to catch new viewers
        const readyInterval = setInterval(() => {
          channel.send({
            type: 'broadcast',
            event: 'host-ready',
            payload: { streamId },
          });
        }, 5000);
        
        return () => clearInterval(readyInterval);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, streamId]);

  // Cache ICE servers for reuse
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]);

  // Fetch TURN credentials on mount
  useEffect(() => {
    const fetchTurnCredentials = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-turn-credentials');
        if (!error && data?.iceServers) {
          iceServersRef.current = data.iceServers;
          console.log("[Host] Got TURN credentials, servers:", data.iceServers.length);
        }
      } catch (err) {
        console.warn("[Host] Could not fetch TURN credentials:", err);
      }
    };
    fetchTurnCredentials();
  }, []);

  // Handle new viewer connection
  const handleViewerJoin = async (viewerId: string, channel: any) => {
    if (!streamRef.current) {
      console.log("[Host] No stream available yet, queuing viewer:", viewerId);
      // Queue this viewer for when stream is ready
      setTimeout(() => handleViewerJoin(viewerId, channel), 1000);
      return;
    }

    // Check if we already have a connection for this viewer
    const existingPc = viewersRef.current.get(viewerId);
    if (existingPc) {
      // If existing connection is still good, resend the offer
      if (existingPc.connectionState === 'connected') {
        console.log("[Host] Connection already established for viewer:", viewerId);
        return;
      }
      if (existingPc.connectionState === 'connecting' || existingPc.connectionState === 'new') {
        console.log("[Host] Connection in progress for viewer:", viewerId);
        return;
      }
      // Close stale connection
      console.log("[Host] Closing stale connection for viewer:", viewerId);
      existingPc.close();
      viewersRef.current.delete(viewerId);
    }

    console.log("[Host] Creating peer connection for viewer:", viewerId);

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Add local stream tracks - CRITICAL: make sure tracks are properly added
    const tracks = streamRef.current.getTracks();
    console.log("[Host] Available tracks:", tracks.length);
    tracks.forEach(track => {
      console.log("[Host] Adding track:", track.kind, "enabled:", track.enabled, "readyState:", track.readyState);
      if (track.readyState === 'live') {
        pc.addTrack(track, streamRef.current!);
      }
    });

    // Collect ICE candidates and send them
    const iceCandidates: RTCIceCandidate[] = [];
    let isIceGatheringComplete = false;
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        iceCandidates.push(event.candidate);
        // Send ICE candidates immediately
        channel.send({
          type: 'broadcast',
          event: 'ice-candidate-from-host',
          payload: { viewerId, candidate: event.candidate },
        });
      } else {
        // ICE gathering complete
        isIceGatheringComplete = true;
        console.log(`[Host] ICE gathering complete for ${viewerId}, sent ${iceCandidates.length} candidates`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Host] ICE state for ${viewerId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.log(`[Host] ICE failed for ${viewerId}, restarting...`);
        pc.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        // Wait briefly for recovery
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log(`[Host] ICE still disconnected for ${viewerId}, restarting...`);
            pc.restartIce();
          }
        }, 2000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Host] Connection state for ${viewerId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log(`[Host] Successfully connected to viewer ${viewerId}`);
      } else if (pc.connectionState === 'disconnected') {
        // Give it a moment to recover before cleaning up
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.log(`[Host] Cleaning up stale connection for ${viewerId}`);
            pc.close();
            viewersRef.current.delete(viewerId);
            setViewerCount(viewersRef.current.size);
          }
        }, 5000);
      } else if (pc.connectionState === 'failed') {
        console.log(`[Host] Connection failed for ${viewerId}`);
        viewersRef.current.delete(viewerId);
        setViewerCount(viewersRef.current.size);
        pc.close();
      }
    };

    // Store the connection immediately so we don't create duplicates
    viewersRef.current.set(viewerId, pc);
    setViewerCount(viewersRef.current.size);

    try {
      // Create offer with proper settings for sending media
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      // Wait briefly for some ICE candidates to be gathered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send offer to viewer
      console.log("[Host] Sending offer to viewer:", viewerId);
      channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { viewerId, offer: pc.localDescription },
      });
    } catch (err) {
      console.error("[Host] Error creating offer:", err);
      pc.close();
      viewersRef.current.delete(viewerId);
      setViewerCount(viewersRef.current.size);
    }
  };

  // Subscribe to comments - FIXED: properly fetch and display with profiles
  useEffect(() => {
    const fetchComments = async () => {
      const { data: commentsData } = await supabase
        .from("live_stream_comments")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Fetch profiles separately for reliability
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: profileMap.get(comment.user_id) || null,
      }));

      setComments(commentsWithProfiles);
      
      // Auto-scroll chat
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    };

    fetchComments();

    const channel = supabase
      .channel(`host-comments-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload) => {
        // Fetch the new comment's profile immediately
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .eq("id", payload.new.user_id)
          .single();

        const newComment = {
          ...payload.new,
          profiles: profile,
        };

        setComments(prev => [...prev, newComment]);

        // Auto-scroll
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to reactions - FIXED: show who sent the reaction
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        // Fetch sender profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", payload.new.user_id)
          .single();

        const senderName = profile?.display_name || profile?.username || 'Someone';

        const newReaction = { 
          type: payload.new.reaction_type, 
          id: Date.now() + Math.random(),
          x: Math.random() * 40 + 55,
          y: Math.random() * 30 + 40,
          senderName,
        };
        setReactions(prev => [...prev, newReaction]);
        
        // Show toast with sender name
        toast(`${senderName} sent ${REACTION_EMOJIS[payload.new.reaction_type] || '❤️'}`, {
          duration: 2000,
        });

        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to viewer count updates and fetch viewer profiles
  useEffect(() => {
    const fetchViewers = async () => {
      const { data, count } = await supabase
        .from("live_stream_viewers")
        .select("user_id", { count: 'exact' })
        .eq("stream_id", streamId)
        .eq("is_active", true);

      setViewerCount(count || 0);

      if (data && data.length > 0) {
        const userIds = data.map(v => v.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);
          setViewers(profiles || []);
        }
      }

      // Update stream viewer count
      await supabase
        .from("live_streams")
        .update({ viewer_count: count || 0 })
        .eq("id", streamId);
    };

    fetchViewers();

    const channel = supabase
      .channel(`viewers-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        // Show user joined notification
        if (payload.new.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', payload.new.user_id)
            .single();
          
          if (profile) {
            toast(`👋 ${profile.display_name || profile.username} joined the stream`, {
              duration: 3000,
            });
          }
        }
        fetchViewers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchViewers())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to gifts received - FIXED: TikTok style with sender names
  useEffect(() => {
    if (!user) return;

    const fetchGifts = async () => {
      const { data } = await supabase
        .from("live_stream_gifts")
        .select("credit_value")
        .eq("stream_id", streamId)
        .eq("receiver_id", user.id);

      const total = data?.reduce((sum, g) => sum + (g.credit_value || 0), 0) || 0;
      setTotalGiftsReceived(total);
    };

    fetchGifts();

    const channel = supabase
      .channel(`gifts-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        if (payload.new.receiver_id === user.id) {
          setTotalGiftsReceived(prev => prev + (payload.new.credit_value || 0));
          
          // Get sender name for flying gift
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', payload.new.sender_id)
            .single();
          
          // Add flying gift with prominent display
          const newGift = {
            id: payload.new.id,
            gift_type: payload.new.gift_type,
            sender_name: senderProfile?.display_name || senderProfile?.username || 'Someone',
            credit_value: payload.new.credit_value || 0,
          };
          setFlyingGifts(prev => [...prev, newGift]);
          
          // Remove after animation
          setTimeout(() => {
            setFlyingGifts(prev => prev.filter(g => g.id !== newGift.id));
          }, 5000);
          
          toast.success(`🎁 ${newGift.sender_name} sent ${payload.new.gift_type}! +${payload.new.credit_value} credits`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, user]);

  const sendComment = async () => {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment("");
  };

  const getReactionEmoji = (type: string) => {
    return REACTION_EMOJIS[type] || '❤️';
  };

  const handleInviteToSpeak = async (userId: string) => {
    if (coHosts.length >= 4) {
      toast.error("Maximum 4 co-hosts allowed");
      return;
    }
    
    // For now, just add to coHosts list - in full implementation would send WebRTC invite
    setCoHosts(prev => [...prev, userId]);
    
    const viewer = viewers.find(v => v.id === userId);
    if (viewer) {
      toast.success(`Invited ${viewer.display_name} to speak!`);
      
      // Send notification comment
      await supabase.from("live_stream_comments").insert({
        stream_id: streamId,
        user_id: user?.id,
        content: `🎤 ${viewer.display_name} has been invited to speak!`,
      });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/stream/${streamId}`;
    
    // Try native share first (mobile devices)
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: stream?.title || 'Live Stream',
          text: `Watch my live stream: ${stream?.title}`,
          url: shareUrl,
        });
        return;
      } catch (error: any) {
        // If user cancelled, don't fall through to clipboard
        if (error?.name === 'AbortError') return;
      }
    }
    
    // Fallback to clipboard with multiple methods
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success('Link copied to clipboard!');
        } else {
          toast.error('Could not copy link. Please copy manually: ' + shareUrl);
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Could not copy link. Please copy manually: ' + shareUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex">
      {/* Desktop: 9:16 centered video with side chat */}
      <div className="hidden lg:flex w-full h-full">
        {/* Left spacer */}
        <div className="flex-1 bg-black/95" />
        
        {/* Center: 9:16 Video Container */}
        <div className="relative h-full" style={{ aspectRatio: '9/16', maxWidth: '100vh' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover",
              isFrontCamera && "scale-x-[-1]"
            )}
          />

          {/* Not Live Yet Overlay */}
          {!isLive && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center">
                <Radio className="w-20 h-20 mx-auto mb-4 text-primary animate-pulse" />
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Go Live?</h2>
                <p className="text-muted-foreground mb-6">
                  {stream?.title || "Your stream"}
                </p>
                <Button
                  size="lg"
                  onClick={startBroadcast}
                  disabled={isStarting}
                  className="bg-red-600 hover:bg-red-700 text-white px-8"
                >
                  {isStarting ? "Starting..." : "Start Broadcasting"}
                </Button>
              </div>
            </div>
          )}

          {/* Live Badge & Stats */}
          {isLive && (
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse px-3 py-1 text-sm">
                <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping" />
                LIVE
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Users className="w-4 h-4 mr-1" />
                {viewerCount}
              </Badge>
              {totalGiftsReceived > 0 && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1">
                  <Coins className="w-4 h-4 mr-1" />
                  {totalGiftsReceived}
                </Badge>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="absolute top-4 right-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={isLive ? stopBroadcast : onClose}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Flying Chat Overlay */}
          {isLive && (
            <FlyingChat 
              messages={comments} 
              gifts={flyingGifts}
              maxMessages={10}
            />
          )}

          {/* Floating Reactions with sender names */}
          <AnimatePresence>
            {reactions.map((reaction) => (
              <motion.div
                key={reaction.id}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ 
                  opacity: 0, 
                  y: -200, 
                  scale: [1, 1.4, 1.2],
                  x: [0, Math.random() * 40 - 20, Math.random() * 60 - 30]
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, ease: "easeOut" }}
                className="absolute text-4xl pointer-events-none z-30 flex flex-col items-center"
                style={{
                  right: `${100 - reaction.x}%`,
                  bottom: `${reaction.y}%`,
                }}
              >
                <span>{getReactionEmoji(reaction.type)}</span>
                {reaction.senderName && (
                  <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
                    {reaction.senderName}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Host Action Buttons */}
          {isLive && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-green-500/80 hover:bg-green-600"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5 text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-pink-500/80 hover:bg-pink-600"
                onClick={() => setShowGiftModal(true)}
              >
                <Gift className="w-5 h-5 text-white" />
              </Button>
              
              {/* Viewer List Panel */}
              <ViewerListPanel
                viewers={viewers}
                viewerCount={viewerCount}
                streamId={streamId}
                onInviteToSpeak={handleInviteToSpeak}
                coHosts={coHosts}
                maxCoHosts={4}
              />
              
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-blue-500/80 hover:bg-blue-600"
                onClick={() => setShowInviteModal(true)}
              >
                <UserPlus className="w-5 h-5 text-white" />
              </Button>
            </div>
          )}

          {/* Control Bar */}
          {isLive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  !isVideoOn && "bg-red-600 hover:bg-red-700"
                )}
                onClick={toggleVideo}
              >
                {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-full",
                  !isAudioOn && "bg-red-600 hover:bg-red-700"
                )}
                onClick={toggleAudio}
              >
                {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={switchCamera}
              >
                <FlipHorizontal className="w-5 h-5 text-white" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full ml-2"
                onClick={stopBroadcast}
              >
                End Stream
              </Button>
            </div>
          )}
        </div>

        {/* Right: Chat Panel for Desktop */}
        {isLive && (
          <div className="w-96 bg-background/95 border-l border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Live Chat
              </h3>
              <p className="text-sm text-muted-foreground">{comments.length} messages</p>
            </div>

            <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 items-start">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary/20">
                        {comment.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-primary">
                        {comment.profiles?.display_name || 'Anonymous'}
                      </span>
                      <p className="text-sm break-words">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Say something..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                  className="flex-1"
                />
                <Button size="icon" onClick={sendComment}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Right spacer when not live */}
        {!isLive && <div className="flex-1 bg-black/95" />}
      </div>

      {/* Mobile/Tablet: Full screen video */}
      <div className="lg:hidden absolute inset-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            isFrontCamera && "scale-x-[-1]"
          )}
          style={{
            objectPosition: 'center center',
            minWidth: '100%',
            minHeight: '100%',
          }}
        />

        {/* Not Live Yet Overlay */}
        {!isLive && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <Radio className="w-20 h-20 mx-auto mb-4 text-primary animate-pulse" />
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Go Live?</h2>
              <p className="text-muted-foreground mb-6">
                {stream?.title || "Your stream"}
              </p>
              <Button
                size="lg"
                onClick={startBroadcast}
                disabled={isStarting}
                className="bg-red-600 hover:bg-red-700 text-white px-8"
              >
                {isStarting ? "Starting..." : "Start Broadcasting"}
              </Button>
            </div>
          </div>
        )}

        {/* Live Badge & Stats */}
        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-3 z-20">
            <Badge variant="destructive" className="animate-pulse px-3 py-1 text-sm">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-ping" />
              LIVE
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <Users className="w-4 h-4 mr-1" />
              {viewerCount}
            </Badge>
          </div>
        )}

        {/* Close and Home Buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate('/feed')}
            title="Go to Feed"
          >
            <Home className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={isLive ? stopBroadcast : onClose}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Flying Chat Overlay */}
        {isLive && (
          <FlyingChat 
            messages={comments} 
            gifts={flyingGifts}
            maxMessages={8}
          />
        )}

        {/* Floating Reactions with sender names */}
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ 
                opacity: 0, 
                y: -200, 
                scale: [1, 1.4, 1.2],
                x: [0, Math.random() * 40 - 20, Math.random() * 60 - 30]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: "easeOut" }}
              className="absolute text-4xl pointer-events-none z-30 flex flex-col items-center"
              style={{
                right: `${100 - reaction.x}%`,
                bottom: `${reaction.y}%`,
              }}
            >
              <span>{getReactionEmoji(reaction.type)}</span>
              {reaction.senderName && (
                <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
                  {reaction.senderName}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Gifts Received Badge */}
        {isLive && totalGiftsReceived > 0 && (
          <div className="absolute top-4 right-24 flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1 rounded-full z-20">
            <Coins className="w-4 h-4" />
            <span className="font-bold">{totalGiftsReceived}</span>
          </div>
        )}

        {/* Host Action Buttons */}
        {isLive && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-green-500/80 hover:bg-green-600"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5 text-white" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-pink-500/80 hover:bg-pink-600"
              onClick={() => setShowGiftModal(true)}
            >
              <Gift className="w-5 h-5 text-white" />
            </Button>
            
            {/* Viewer List Panel */}
            <ViewerListPanel
              viewers={viewers}
              viewerCount={viewerCount}
              streamId={streamId}
              onInviteToSpeak={handleInviteToSpeak}
              coHosts={coHosts}
              maxCoHosts={4}
            />
            
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-blue-500/80 hover:bg-blue-600"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="w-5 h-5 text-white" />
            </Button>
          </div>
        )}

        {/* Control Bar */}
        {isLive && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 z-20">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full",
                !isVideoOn && "bg-red-600 hover:bg-red-700"
              )}
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full",
                !isAudioOn && "bg-red-600 hover:bg-red-700"
              )}
              onClick={toggleAudio}
            >
              {isAudioOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={switchCamera}
            >
              <FlipHorizontal className="w-5 h-5 text-white" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize className="w-5 h-5 text-white" /> : <Maximize className="w-5 h-5 text-white" />}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full ml-2"
              onClick={stopBroadcast}
            >
              End Stream
            </Button>
          </div>
        )}
      </div>

      {/* Gift Modal */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={user?.id || ""}
        viewers={viewers}
        isHost={true}
      />

      {/* Invite Modal */}
      <LiveInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        streamId={streamId}
        currentCoHostCount={coHosts.length}
        maxCoHosts={4}
      />
    </div>
  );
};