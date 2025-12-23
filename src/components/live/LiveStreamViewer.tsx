import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Send, Heart, ThumbsUp, X, Gift, Share2, 
  UserPlus, Crown, Sparkles, Flame, Star, MessageCircle,
  Volume2, VolumeX, Maximize, Settings, MoreVertical
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { LiveGiftModal } from "./LiveGiftModal";
import { LiveInviteModal } from "./LiveInviteModal";
import { useAuth } from "@/hooks/useAuth";
import AnimatedGiftEmoji from "@/components/shared/AnimatedGiftEmoji";

interface LiveStreamViewerProps {
  streamId: string;
  onClose: () => void;
}

interface GiftNotification {
  id: string;
  senderName: string;
  giftType: string;
  creditValue: number;
}

const REACTION_EMOJIS = [
  { emoji: '❤️', type: 'heart' },
  { emoji: '🔥', type: 'fire' },
  { emoji: '👏', type: 'clap' },
  { emoji: '😂', type: 'laugh' },
  { emoji: '🎉', type: 'party' },
  { emoji: '💯', type: '100' },
];

export const LiveStreamViewer = ({ streamId, onClose }: LiveStreamViewerProps) => {
  const { user } = useAuth();
  const [stream, setStream] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [viewerSession, setViewerSession] = useState<string | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [giftNotifications, setGiftNotifications] = useState<GiftNotification[]>([]);
  const [viewers, setViewers] = useState<any[]>([]);
  const [totalGifts, setTotalGifts] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isHost = stream?.user_id === user?.id;

  useEffect(() => {
    fetchStream();
    joinStream();
    fetchViewers();
    fetchTotalGifts();

    const channel = supabase
      .channel(`live-stream-${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchComments())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`,
      }, (payload: any) => {
        if (payload.new.status === 'ended') {
          toast.info('Stream has ended');
          onClose();
        }
        setStream(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_reactions',
        filter: `stream_id=eq.${streamId}`,
      }, (payload: any) => {
        const reaction = {
          id: payload.new.id,
          emoji: getEmojiFromType(payload.new.reaction_type),
          x: Math.random() * 60 + 20,
        };
        setFloatingReactions(prev => [...prev, reaction]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 3000);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_gifts',
        filter: `stream_id=eq.${streamId}`,
      }, async (payload: any) => {
        const { data: sender } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', payload.new.sender_id)
          .single();

        const notification: GiftNotification = {
          id: payload.new.id,
          senderName: sender?.display_name || 'Someone',
          giftType: payload.new.gift_type,
          creditValue: payload.new.credit_value,
        };

        setGiftNotifications(prev => [...prev, notification]);
        fetchTotalGifts();

        setTimeout(() => {
          setGiftNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_stream_viewers',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchViewers())
      .subscribe();

    return () => {
      leaveStream();
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const getEmojiFromType = (type: string) => {
    const mapping: Record<string, string> = {
      heart: '❤️', fire: '🔥', clap: '👏', laugh: '😂', party: '🎉', '100': '💯',
      like: '👍', thumbsup: '👍',
    };
    return mapping[type] || '❤️';
  };

  const fetchStream = async () => {
    const { data: streamData, error } = await supabase
      .from("live_streams")
      .select("*")
      .eq("id", streamId)
      .single();

    if (error) {
      toast.error("Failed to load stream");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", streamData.user_id)
      .single();

    setStream({ ...streamData, profiles: profileData });
    fetchComments();
  };

  const fetchComments = async () => {
    const { data: commentsData } = await supabase
      .from("live_stream_comments")
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!commentsData) return;

    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    setComments(commentsData.map(c => ({ ...c, profiles: profileMap.get(c.user_id) })));
  };

  const fetchViewers = async () => {
    const { data } = await supabase
      .from("live_stream_viewers")
      .select("user_id")
      .eq("stream_id", streamId)
      .eq("is_active", true);

    if (data && data.length > 0) {
      const userIds = data.map(v => v.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      setViewers(profiles || []);
    }
  };

  const fetchTotalGifts = async () => {
    const { data } = await supabase
      .from("live_stream_gifts")
      .select("credit_value")
      .eq("stream_id", streamId);

    const total = data?.reduce((sum, g) => sum + g.credit_value, 0) || 0;
    setTotalGifts(total);
  };

  const joinStream = async () => {
    const { data, error } = await supabase
      .from("live_stream_viewers")
      .insert({
        stream_id: streamId,
        user_id: user?.id || null,
        is_active: true,
      })
      .select()
      .single();

    if (!error) setViewerSession(data.id);
  };

  const leaveStream = async () => {
    if (viewerSession) {
      await supabase
        .from("live_stream_viewers")
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq("id", viewerSession);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim() || !user) {
      if (!user) toast.error("Please log in to comment");
      return;
    }

    await supabase.from("live_stream_comments").insert({
      stream_id: streamId,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment("");
  };

  const sendReaction = async (reactionType: string) => {
    if (!user) return;
    await supabase.from("live_stream_reactions").insert({
      stream_id: streamId,
      user_id: user.id,
      reaction_type: reactionType,
    });
  };

  const endStream = async () => {
    if (!isHost) return;
    await supabase
      .from("live_streams")
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq("id", streamId);
    toast.success("Stream ended");
    onClose();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/live/stream/${streamId}`;
    if (navigator.share) {
      await navigator.share({ title: stream?.title, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  };

  if (!stream) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Floating Reactions */}
      <AnimatePresence>
        {floatingReactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -300, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3 }}
            className="absolute text-4xl pointer-events-none z-50"
            style={{ left: `${reaction.x}%`, bottom: '25%' }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Gift Notifications */}
      <div className="absolute top-20 left-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {giftNotifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-xl border border-amber-500/30"
            >
              <AnimatedGiftEmoji giftType={notification.giftType} size={40} />
              <div>
                <p className="text-sm font-semibold text-white">
                  {notification.senderName} sent a {notification.giftType}!
                </p>
                <p className="text-xs text-amber-400">{notification.creditValue} credits</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Video Area */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/30 to-pink-500/30 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/50 animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-red-500" />
            </div>
          </div>
          <p className="text-white/50 text-sm">Video stream would appear here</p>
        </div>
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 ring-2 ring-primary">
              <AvatarImage src={stream.profiles?.avatar_url} />
              <AvatarFallback>{stream.profiles?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white">{stream.profiles?.display_name}</h2>
                {isHost && <Badge className="bg-amber-500 text-white">Host</Badge>}
              </div>
              <p className="text-sm text-white/70 line-clamp-1">{stream.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-red-400">LIVE</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10">
              <Users className="w-3 h-3 text-white" />
              <span className="text-xs font-semibold text-white">{stream.viewer_count || 0}</span>
            </div>
            {totalGifts > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <Gift className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">{totalGifts}</span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        {/* Quick Reactions */}
        <div className="flex justify-center gap-2 py-3 px-4">
          {REACTION_EMOJIS.map(({ emoji, type }) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.2 }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-xl transition-colors"
              onClick={() => sendReaction(type)}
            >
              {emoji}
            </motion.button>
          ))}
        </div>

        {/* Chat Area */}
        {showChat && (
          <div className="px-4 pb-2">
            <ScrollArea className="h-40 mb-2">
              <div className="space-y-2">
                {comments.slice(-20).map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2"
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={comment.profiles?.avatar_url} />
                      <AvatarFallback className="text-[10px]">
                        {comment.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-white/10 rounded-xl px-3 py-1.5">
                      <span className="text-xs font-semibold text-primary mr-2">
                        {comment.profiles?.display_name || 'Anonymous'}
                      </span>
                      <span className="text-sm text-white">{comment.content}</span>
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Input & Actions */}
        <div className="flex items-center gap-2 p-4 pb-6">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Say something..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendComment()}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            <Button onClick={sendComment} className="bg-primary hover:bg-primary/90">
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 relative"
              onClick={() => setShowGiftModal(true)}
            >
              <Gift className="w-5 h-5" />
              <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5" />
            </Button>
            {isHost && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => setShowInviteModal(true)}
                >
                  <UserPlus className="w-5 h-5" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={endStream}
                >
                  End Stream
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <LiveGiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        streamId={streamId}
        hostId={stream.user_id}
        viewers={viewers}
        isHost={isHost}
      />

      <LiveInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        streamId={streamId}
      />
    </div>
  );
};
