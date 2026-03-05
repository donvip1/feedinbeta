import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
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
  Headphones,
  Share2,
  Trash2,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LiveDiscoverCard } from "./LiveDiscoverCard";
import { LiveNotificationsPanel } from "./LiveNotificationsPanel";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "sonner";

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
const mainTabs = ["Discover", "Replays"] as const;
type MainTab = typeof mainTabs[number];

const getTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

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
  const location = useLocation();
  const queryClient = useQueryClient();
  const { permissions } = useAdminRole();
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<MainTab>((location.state as any)?.tab === 'Replays' ? 'Replays' : 'Discover');
  const [showNotifications, setShowNotifications] = useState(false);
  const [deletingSpaceId, setDeletingSpaceId] = useState<string | null>(null);

  // Clear location state after reading it
  useEffect(() => {
    if ((location.state as any)?.tab) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelectSpace = (e: React.MouseEvent, spaceId: string) => {
    e.stopPropagation();
    setSelectedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!recordedSpaces) return;
    if (selectedSpaces.size === recordedSpaces.length) {
      setSelectedSpaces(new Set());
    } else {
      setSelectedSpaces(new Set(recordedSpaces.map((s: any) => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSpaces.size === 0) return;
    if (!confirm(`Delete ${selectedSpaces.size} recorded space(s) permanently?`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedSpaces);
    queryClient.setQueryData(['recorded-spaces'], (old: any[] | undefined) =>
      old ? old.filter((s: any) => !selectedSpaces.has(s.id)) : []
    );
    try {
      const { data, error } = await supabase.rpc('delete_spaces_bulk', { p_space_ids: ids });
      if (error) throw error;
      toast.success(`${data || ids.length} space(s) permanently deleted`);
      setSelectedSpaces(new Set());
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    } finally {
      setBulkDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['recorded-spaces'] });
    }
  };
  const canDeleteAny = permissions.isAdmin || permissions.isModerator || permissions.isDeveloper;

  const handleDeleteSpace = async (e: React.MouseEvent, spaceId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this recorded space permanently?")) return;
    setDeletingSpaceId(spaceId);
    queryClient.setQueryData(['recorded-spaces'], (old: any[] | undefined) => 
      old ? old.filter((s: any) => s.id !== spaceId) : []
    );
    try {
      const { data, error } = await supabase.rpc('delete_space_completely', { p_space_id: spaceId });
      if (error) throw error;
      if (!data) throw new Error("Not found or permission denied");
      toast.success("Space permanently deleted");
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    } finally {
      setDeletingSpaceId(null);
      queryClient.invalidateQueries({ queryKey: ['recorded-spaces'] });
    }
  };

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
    staleTime: 5 * 60 * 1000,
  });

  // Fetch recorded/ended spaces
  const { data: recordedSpaces } = useQuery({
    queryKey: ['recorded-spaces'],
    queryFn: async () => {
      const { data: spaces, error } = await supabase
        .from('live_spaces')
        .select('id, title, description, user_id, recording_url, cover_image_url, viewer_count, peak_viewers, ended_at, started_at, topic_category, share_link')
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch recorded spaces:', error);
        return [];
      }
      if (!spaces || spaces.length === 0) return [];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(spaces.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return spaces.map(space => ({
        ...space,
        profiles: profileMap.get(space.user_id) || null,
      }));
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="h-[100dvh] bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <header className="px-5 pt-[env(safe-area-inset-top)] flex flex-col gap-3 bg-black/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex justify-between items-center pt-12 pb-1">
          <div className="flex items-center gap-2">
            <Tv className="w-6 h-6 text-pink-500" />
            <span className="text-xl font-black">FeedIn Live</span>
          </div>

          <div className="flex items-center gap-2">
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
            <button
              onClick={onGoLive}
              className="bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-pink-500/25 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" /> Go Live
            </button>
          </div>
        </div>

        {/* Main Tabs: Discover / Replays */}
        <div className="flex gap-6 py-2 -mx-4 px-4">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap pb-2 text-sm font-bold transition-all relative shrink-0",
                activeTab === tab ? "text-white" : "text-slate-500"
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Category Filters (only on Discover tab) */}
        {activeTab === 'Discover' && (
          <div className="flex gap-6 overflow-x-auto no-scrollbar py-2 border-b border-white/5 -mx-4 px-4">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "whitespace-nowrap pb-2 text-xs font-semibold transition-all relative shrink-0",
                  activeFilter === f ? "text-white" : "text-slate-500"
                )}
              >
                {f}
                {activeFilter === f && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30 rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content Area - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [--webkit-overflow-scrolling:touch]" style={{ WebkitOverflowScrolling: 'touch' }} data-scrollable="true">
        <div className="px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 max-w-2xl mx-auto space-y-8 w-full">

      {activeTab === 'Replays' ? (
          /* ===== REPLAYS TAB ===== */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-base">Space Replays</span>
              </div>
              <span className="text-xs text-slate-500">{recordedSpaces?.length || 0} spaces</span>
            </div>

            {/* Bulk actions for admins/mods */}
            {canDeleteAny && recordedSpaces && recordedSpaces.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors border border-white/10"
                >
                  {selectedSpaces.size === recordedSpaces.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedSpaces.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="text-xs px-3 py-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors border border-red-500/20 disabled:opacity-50"
                  >
                    {bulkDeleting ? 'Deleting...' : `Delete ${selectedSpaces.size} selected`}
                  </button>
                )}
              </div>
            )}

            {(!recordedSpaces || recordedSpaces.length === 0) ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Headphones className="w-10 h-10 text-purple-400/50" />
                </div>
                <p className="text-white/60 text-center font-medium">No recordings yet</p>
                <p className="text-sm text-white/40 text-center">Recorded spaces will appear here for replay</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recordedSpaces.map((space: any, index: number) => {
                  const duration = space.started_at && space.ended_at
                    ? Math.floor((new Date(space.ended_at).getTime() - new Date(space.started_at).getTime()) / 60000)
                    : 0;
                  const durationStr = duration >= 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : duration > 0 ? `${duration}m` : '';
                  const endedDate = space.ended_at ? new Date(space.ended_at) : null;
                  const isOwner = space.user_id === user?.id;
                  const showDelete = canDeleteAny || isOwner;

                  return (
                    <motion.div
                      key={space.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.03, 0.3) }}
                      onClick={() => navigate(`/live/space/${space.id}`)}
                      className={cn(
                        "rounded-2xl bg-slate-900/60 border overflow-hidden active:scale-[0.98] transition-transform cursor-pointer",
                        selectedSpaces.has(space.id) ? "border-purple-500/50 bg-purple-500/10" : "border-white/5"
                      )}
                    >
                      {/* Cover image / gradient header */}
                      <div className="relative h-28 w-full overflow-hidden">
                        {space.cover_image_url ? (
                          <img src={space.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-900/60 via-slate-800/80 to-pink-900/40" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        
                        {/* Play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Top badges */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          {space.recording_url ? (
                            <span className="text-[9px] font-bold text-purple-200 bg-purple-500/30 backdrop-blur-sm px-2 py-0.5 rounded-full uppercase tracking-wider">Replay</span>
                          ) : (
                            <span className="text-[9px] font-bold text-white/60 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full uppercase tracking-wider">Ended</span>
                          )}
                          {space.topic_category && (
                            <span className="text-[9px] font-medium text-white/60 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">{space.topic_category}</span>
                          )}
                        </div>

                        {/* Duration badge */}
                        {durationStr && (
                          <div className="absolute top-2.5 right-2.5 text-[10px] font-semibold text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            {durationStr}
                          </div>
                        )}

                        {/* Admin checkbox */}
                        {canDeleteAny && (
                          <button
                            onClick={(e) => toggleSelectSpace(e, space.id)}
                            className={cn(
                              "absolute bottom-2.5 left-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
                              selectedSpaces.has(space.id) ? "bg-purple-500 border-purple-500" : "border-white/30 bg-black/30 backdrop-blur-sm"
                            )}
                          >
                            {selectedSpaces.has(space.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-3">
                        <p className="font-semibold text-sm text-white leading-snug line-clamp-2">{space.title}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={(space.profiles as any)?.avatar_url} />
                            <AvatarFallback className="text-[8px] bg-slate-700">{(space.profiles as any)?.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-white/50 truncate flex-1">
                            {(space.profiles as any)?.display_name || 'Creator'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center gap-3 text-[11px] text-white/30">
                            {space.peak_viewers ? (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" /> {space.peak_viewers}
                              </span>
                            ) : null}
                            {endedDate && (
                              <span>{format(endedDate, 'MMM d, h:mm a')}</span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `https://feedinn.com/live/space/${space.id}`;
                                if (navigator.share) {
                                  navigator.share({ title: space.title, url });
                                } else {
                                  navigator.clipboard.writeText(url);
                                  toast.success("Link copied!");
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all"
                            >
                              <Share2 className="w-3.5 h-3.5 text-white/40" />
                            </button>
                            {showDelete && (
                              <button
                                onClick={(e) => handleDeleteSpace(e, space.id)}
                                disabled={deletingSpaceId === space.id}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 active:scale-90 transition-all"
                              >
                                <Trash2 className={cn("w-3.5 h-3.5", deletingSpaceId === space.id ? "text-white/20 animate-spin" : "text-red-400/60")} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        /* ===== DISCOVER TAB ===== */
        <>
        {/* Active Stream/Space Return Banner */}
        {myActiveStream ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onStreamClick(myActiveStream)}
            className="bg-zinc-900 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="h-32 bg-gradient-to-br from-green-900/50 to-emerald-900/50 relative flex items-center justify-center">
              <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                You're Live
              </div>
              <Radio className="w-10 h-10 text-white/30 animate-pulse" />
            </div>
            <div className="p-4">
              <p className="font-semibold text-sm">{myActiveStream.title}</p>
              <p className="text-white/50 text-xs mt-1">{myActiveStream.viewer_count || 0} watching • Tap to return</p>
            </div>
          </motion.div>
        ) : myActiveSpace ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onSpaceClick(myActiveSpace)}
            className="bg-zinc-900 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="h-32 bg-gradient-to-br from-green-900/50 to-emerald-900/50 relative flex items-center justify-center">
              <div className="absolute top-3 left-3 bg-green-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Space Active
              </div>
              <Mic className="w-10 h-10 text-white/30 animate-pulse" />
            </div>
            <div className="p-4">
              <p className="font-semibold text-sm">{myActiveSpace.title}</p>
              <p className="text-white/50 text-xs mt-1">{myActiveSpace.viewer_count || myActiveSpace.active_listeners || 0} listening • Tap to return</p>
            </div>
          </motion.div>
        ) : null}


        {/* Trending Now Section - uses filtered content */}
        {filteredContent.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-lg font-bold">
                {activeFilter === 'All' ? 'Trending Now' : `${activeFilter} Streams`}
              </span>
            </div>

            <div className="space-y-4">
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
                    thumbnailUrl={item.thumbnail_url || item.cover_image_url}
                    description={item.description}
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
                    thumbnailUrl={space.cover_image_url}
                    description={space.description}
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
                    }}
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {(!recommendedCreators || recommendedCreators.length === 0) && hasContent && (
                <p className="text-white/40 text-center py-4 text-sm">
                  More creators will appear here as they go live
                </p>
              )}
            </div>
          )}
        </div>
        </>
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
