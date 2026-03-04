import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Bell,
  Plus,
  Flame,
  ChevronRight,
  Play,
  Radio,
  Users,
  Mic,
  Video,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LiveDiscoverCard } from "./LiveDiscoverCard";
import { LiveNotificationsPanel } from "./LiveNotificationsPanel";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LiveDashboardProps {
  liveStreams: any[] | undefined;
  liveSpaces: any[] | undefined;
  scheduledStreams: any[] | undefined;
  scheduledSpaces: any[] | undefined;
  myStreams: any[] | undefined;
  mySpaces: any[] | undefined;
  user: any;
  followerCount?: number;
  onStreamClick: (stream: any) => void;
  onSpaceClick: (space: any) => void;
  onGoLive: () => void;
  onVideoStream: () => void;
  onAudioSpace: () => void;
  isLoading?: boolean;
  myActiveStream?: any; // User's currently active stream
  myActiveSpace?: any;  // User's currently active space
}

const filters = ["All", "Popular", "Music", "Gaming", "Chat", "Talk Show", "Education", "Tech"];

export const LiveDashboard = ({
  liveStreams,
  liveSpaces,
  scheduledStreams,
  scheduledSpaces,
  myStreams,
  mySpaces,
  user,
  followerCount = 0,
  onStreamClick,
  onSpaceClick,
  onGoLive,
  onVideoStream,
  onAudioSpace,
  isLoading,
  myActiveStream,
  myActiveSpace,
}: LiveDashboardProps) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [showNotifications, setShowNotifications] = useState(false);

  const liveCount = (liveStreams?.length || 0) + (liveSpaces?.length || 0);
  const hasContent = liveCount > 0 || (scheduledStreams?.length || 0) > 0 || (scheduledSpaces?.length || 0) > 0;

  // Combine all live content for display
  const allLiveContent = useMemo(() => [
    ...(liveStreams || []).map((s) => ({ ...s, contentType: "stream" as const })),
    ...(liveSpaces || []).map((s) => ({ ...s, contentType: "space" as const })),
  ], [liveStreams, liveSpaces]);

  // Filter content based on active filter
  const filteredContent = useMemo(() => {
    if (activeFilter === 'All') return allLiveContent;
    if (activeFilter === 'Popular') {
      return [...allLiveContent].sort((a, b) => 
        (b.viewer_count || 0) - (a.viewer_count || 0)
      );
    }
    
    // Filter by category/tags/hashtags
    const filter = activeFilter.toLowerCase().replace(/\s+/g, '_');
    return allLiveContent.filter(item => {
      const itemCategory = (item as any).category?.toLowerCase() || '';
      const itemTopicCategory = (item as any).topic_category?.toLowerCase() || '';
      const itemTags = (item as any).tags || [];
      const itemHashtags = (item as any).hashtags || [];
      
      return itemCategory === filter || 
             itemTopicCategory === filter ||
             itemTags.some((tag: string) => tag.toLowerCase() === filter) ||
             itemHashtags.some((tag: string) => tag.toLowerCase() === filter);
    });
  }, [allLiveContent, activeFilter]);

  // Fetch recommended creators (real users who streamed recently)
  const { data: recommendedCreators } = useQuery({
    queryKey: ['recommended-live-creators'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data } = await supabase
        .from('live_streams')
        .select(`
          user_id,
          viewer_count,
          profiles:user_id (id, display_name, username, avatar_url)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'ended')
        .order('viewer_count', { ascending: false })
        .limit(20);
      
      // Deduplicate by user_id and get unique creators
      const uniqueCreators = new Map<string, any>();
      data?.forEach((s: any) => {
        if (s.profiles && !uniqueCreators.has(s.user_id)) {
          uniqueCreators.set(s.user_id, {
            id: s.user_id,
            ...s.profiles,
            lastViewerCount: s.viewer_count || 0,
          });
        }
      });
      
      return Array.from(uniqueCreators.values()).slice(0, 5);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="px-4 py-4 flex flex-col gap-4 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate("/feed")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">Discover</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Spaces</p>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/search?context=live')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowNotifications(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 relative"
            >
              <Bell className="w-5 h-5" />
              {liveCount > 0 && (
                <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#050505]" />
              )}
            </button>
          </div>
        </div>

        {/* Category Tabs with purple underline */}
        <div className="flex gap-6 overflow-x-auto no-scrollbar py-2 border-b border-white/5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "whitespace-nowrap pb-2 text-sm font-bold transition-all relative",
                activeFilter === f ? "text-white" : "text-slate-500"
              )}
            >
              {f}
              {activeFilter === f && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 pb-32 max-w-2xl mx-auto space-y-8">
        {/* Creator Studio Hero Card */}
        {myActiveStream ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-[2.5rem] p-6 border border-green-500/20 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                <Radio className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-green-400 font-black uppercase tracking-widest">You're Live</p>
                <h2 className="text-xl font-bold truncate">{myActiveStream.title}</h2>
                <p className="text-xs text-slate-500">{myActiveStream.viewer_count || 0} watching now</p>
              </div>
            </div>
            <button
              onClick={() => onStreamClick(myActiveStream)}
              className="w-full py-4 bg-white text-black rounded-full font-black flex items-center justify-center gap-2 hover:bg-green-50 transition-all active:scale-95 relative z-10"
            >
              <Video className="w-4 h-4" />
              RETURN TO STREAM
            </button>
          </motion.div>
        ) : myActiveSpace ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-[2.5rem] p-6 border border-green-500/20 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                <Mic className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-green-400 font-black uppercase tracking-widest">Space Active</p>
                <h2 className="text-xl font-bold truncate">{myActiveSpace.title}</h2>
                <p className="text-xs text-slate-500">{myActiveSpace.viewer_count || myActiveSpace.active_listeners || 0} listening</p>
              </div>
            </div>
            <button
              onClick={() => onSpaceClick(myActiveSpace)}
              className="w-full py-4 bg-white text-black rounded-full font-black flex items-center justify-center gap-2 hover:bg-green-50 transition-all active:scale-95 relative z-10"
            >
              <Mic className="w-4 h-4" />
              RETURN TO SPACE
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#11131E] to-[#0a0b12] rounded-[2.5rem] p-6 border border-white/5 relative overflow-hidden group"
          >
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Radio className="w-7 h-7 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest">Creator Studio</p>
                <h2 className="text-xl font-bold">Ready to broadcast?</h2>
                <p className="text-xs text-slate-500">{followerCount > 0 ? `${followerCount} followers waiting` : 'Your audience is waiting for you'}</p>
              </div>
            </div>
            <button
              onClick={onGoLive}
              className="w-full py-4 bg-white text-black rounded-full font-black flex items-center justify-center gap-2 hover:bg-purple-50 transition-all active:scale-95 relative z-10"
            >
              <Play className="w-4 h-4 fill-black" />
              START GOING LIVE
            </button>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/10 blur-[60px] rounded-full pointer-events-none" />
          </motion.div>
        )}

        {/* Trending Now Section - uses filtered content */}
        {filteredContent.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="font-bold">
                  {activeFilter === 'All' ? 'Trending Now' : `${activeFilter} Streams`}
                </span>
              </div>
              <button className="text-sm text-white/60 flex items-center gap-1 hover:text-white transition-colors">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredContent.slice(0, 6).map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <LiveDiscoverCard
                    id={item.id}
                    title={item.title}
                    hostName={item.profiles?.display_name || item.profiles?.username || "Creator"}
                    hostAvatar={item.profiles?.avatar_url}
                    roomType={item.contentType === "space" ? "audio_space" : "video_broadcast"}
                    viewerCount={item.viewer_count || item.active_listeners || 0}
                    thumbnailUrl={item.thumbnail_url}
                    category={item.category || item.topic_category}
                    hashtags={item.hashtags}
                    trendingScore={item.viewer_count || 0}
                    onClick={() =>
                      item.contentType === "space" ? onSpaceClick(item) : onStreamClick(item)
                    }
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Audio Spaces Section */}
        {liveSpaces && liveSpaces.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-green-500" />
                <span className="font-bold">Audio Spaces</span>
              </div>
              <button className="text-sm text-white/60 flex items-center gap-1 hover:text-white transition-colors">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {liveSpaces.slice(0, 4).map((space, index) => (
                <motion.div
                  key={space.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <LiveDiscoverCard
                    id={space.id}
                    title={space.title}
                    hostName={space.profiles?.display_name || space.profiles?.username || "Host"}
                    hostAvatar={space.profiles?.avatar_url}
                    roomType="audio_space"
                    viewerCount={space.active_listeners || space.viewer_count || 0}
                    category={space.topic_category}
                    hashtags={space.hashtags}
                    trendingScore={space.active_listeners || space.viewer_count || 0}
                    onClick={() => onSpaceClick(space)}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Section */}
        {((scheduledStreams && scheduledStreams.length > 0) ||
          (scheduledSpaces && scheduledSpaces.length > 0)) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="font-bold">Coming Soon</span>
              </div>
              <button className="text-sm text-white/60 flex items-center gap-1 hover:text-white transition-colors">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {[...(scheduledStreams || []), ...(scheduledSpaces || [])].slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/50 border border-white/5"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={item.profiles?.avatar_url} />
                    <AvatarFallback className="bg-blue-500/20 text-blue-400">
                      {item.profiles?.display_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.title}</p>
                    <p className="text-sm text-white/60">
                      {item.profiles?.display_name || "Creator"} • Scheduled
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="border-white/20 text-white/80">
                    <Bell className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended For You / Empty State - Real Data */}
        <div>
          <p className="font-bold mb-4">Recommended For You</p>

          {!hasContent && (!recommendedCreators || recommendedCreators.length === 0) ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <Radio className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-white/60 text-center">No streams live right now</p>
              <p className="text-sm text-white/40 text-center">Check back soon or follow your favorite creators</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(recommendedCreators || []).map((creator) => (
                <div
                  key={creator.id}
                  onClick={() => navigate(`/profile/${creator.id}`)}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={creator.avatar_url} />
                      <AvatarFallback>
                        {creator.display_name?.[0] || creator.username?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    {creator.lastViewerCount > 0 && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full text-[8px] font-bold flex items-center justify-center border-2 border-black">
                        {creator.lastViewerCount > 99 ? '99+' : creator.lastViewerCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {creator.display_name || creator.username || 'Creator'}
                    </p>
                    <p className="text-sm text-white/60">Streamed recently</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-white/20 text-white/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Enable notifications for this creator
                    }}
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {/* Show empty state if no recommended but has live content */}
              {(!recommendedCreators || recommendedCreators.length === 0) && hasContent && (
                <p className="text-white/40 text-center py-4 text-sm">
                  More creators will appear here as they go live
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Notifications Panel */}
      <LiveNotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        liveStreams={liveStreams}
        liveSpaces={liveSpaces}
        onRoomClick={(roomId, roomType) => {
          const item = roomType === 'stream' 
            ? liveStreams?.find(s => s.id === roomId)
            : liveSpaces?.find(s => s.id === roomId);
          if (item) {
            if (roomType === 'stream') {
              onStreamClick(item);
            } else {
              onSpaceClick(item);
            }
          }
        }}
      />
    </div>
  );
};
