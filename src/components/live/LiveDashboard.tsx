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

const filters = ["All", "Popular", "Music", "Gaming", "Chat"];

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
    
    // Filter by category/tags
    return allLiveContent.filter(item => {
      const itemCategory = (item as any).category?.toLowerCase() || '';
      const itemTags = (item as any).tags || [];
      const filter = activeFilter.toLowerCase();
      
      return itemCategory === filter || 
             itemTags.some((tag: string) => tag.toLowerCase() === filter);
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
    <div className="min-h-screen bg-black text-white">
      {/* Modern Header with Glassmorphism */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-black via-black/95 to-transparent backdrop-blur-md px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate("/feed")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h1 className="text-xl font-bold">Discover</h1>
            <p className="text-xs text-white/60">Watch active streams</p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/search?context=live')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors relative">
              <Bell className="w-5 h-5" />
              {liveCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                  {liveCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modern Tabs (Underline style) */}
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "pb-2 text-sm font-bold whitespace-nowrap transition-colors relative",
                activeFilter === f ? "text-white" : "text-slate-500"
              )}
            >
              {f}
              {activeFilter === f && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-violet-500"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 pb-8 space-y-8">
        {/* "My Status" Area - Go Live CTA or Return to Stream */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative rounded-3xl overflow-hidden border p-4 sm:p-6",
            myActiveStream || myActiveSpace
              ? "bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-green-500/30"
              : "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10"
          )}
        >
          {/* Decorative circles */}
          <div className={cn(
            "absolute top-4 left-4 w-10 h-10 rounded-full blur-xl",
            myActiveStream || myActiveSpace ? "bg-green-500/20" : "bg-purple-500/20"
          )} />
          <div className={cn(
            "absolute bottom-4 right-4 w-16 h-16 rounded-full blur-xl",
            myActiveStream || myActiveSpace ? "bg-emerald-500/20" : "bg-pink-500/20"
          )} />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative">
                <Avatar className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 border-2 shrink-0",
                  myActiveStream || myActiveSpace ? "border-green-500" : "border-primary/50"
                )}>
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-pink-500 to-violet-600 text-white text-sm sm:text-base">
                    {user?.display_name?.[0] || user?.username?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                {(myActiveStream || myActiveSpace) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {myActiveStream ? (
                  <>
                    <p className="text-xs sm:text-sm text-green-400 font-medium flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-pulse" /> You're Live
                    </p>
                    <p className="text-base sm:text-xl font-bold truncate">{myActiveStream.title}</p>
                    <p className="text-xs sm:text-sm text-white/60">
                      {myActiveStream.viewer_count || 0} watching now
                    </p>
                  </>
                ) : myActiveSpace ? (
                  <>
                    <p className="text-xs sm:text-sm text-green-400 font-medium flex items-center gap-1">
                      <Mic className="w-3 h-3 animate-pulse" /> Space Active
                    </p>
                    <p className="text-base sm:text-xl font-bold truncate">{myActiveSpace.title}</p>
                    <p className="text-xs sm:text-sm text-white/60">
                      {myActiveSpace.viewer_count || myActiveSpace.active_listeners || 0} listening
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs sm:text-sm text-white/60">Ready to broadcast</p>
                    <p className="text-base sm:text-xl font-bold">Start your Live Journey</p>
                    <p className="text-xs sm:text-sm text-white/60">{followerCount} followers waiting</p>
                  </>
                )}
              </div>
            </div>

            {myActiveStream ? (
              <Button
                onClick={() => onStreamClick(myActiveStream)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 h-9 px-4 text-sm rounded-full w-full sm:w-auto sm:shrink-0"
              >
                <Video className="w-4 h-4 mr-2" />
                Return to Stream
              </Button>
            ) : myActiveSpace ? (
              <Button
                onClick={() => onSpaceClick(myActiveSpace)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 h-9 px-4 text-sm rounded-full w-full sm:w-auto sm:shrink-0"
              >
                <Mic className="w-4 h-4 mr-2" />
                Return to Space
              </Button>
            ) : (
              <Button
                onClick={onGoLive}
                className="bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white shadow-lg shadow-pink-500/25 h-9 px-4 text-sm rounded-full w-full sm:w-auto sm:shrink-0"
              >
                <Play className="w-4 h-4 mr-2" />
                Go Live
              </Button>
            )}
          </div>
        </motion.div>

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

            <div className="grid grid-cols-2 gap-4">
              {filteredContent.slice(0, 4).map((item, index) => (
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

            <div className="grid grid-cols-2 gap-4">
              {liveSpaces.slice(0, 2).map((space, index) => (
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
              <p className="text-white/60 text-center">That's all for now!</p>
              <Button
                onClick={onGoLive}
                className="bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start your own stream
              </Button>
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
    </div>
  );
};
