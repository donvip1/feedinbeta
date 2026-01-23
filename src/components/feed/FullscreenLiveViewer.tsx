import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ArrowLeft, Radio, Mic, Users, Play, Headphones, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LiveItem {
  id: string;
  title: string;
  type: 'video' | 'space';
  status: string;
  viewer_count: number;
  thumbnail_url?: string;
  topic_category?: string;
  host: {
    id?: string;
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

interface FullscreenLiveViewerProps {
  liveContent: LiveItem[];
  onClose: () => void;
  initialIndex?: number;
}

export const FullscreenLiveViewer = ({
  liveContent,
  onClose,
  initialIndex = 0,
}: FullscreenLiveViewerProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showUI, setShowUI] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const currentItem = liveContent[currentIndex];

  // Handle scroll snap to change current item
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const itemHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < liveContent.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, liveContent.length]);

  // Debounced scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(handleScroll, 50);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [handleScroll]);

  const handleJoin = (item: LiveItem) => {
    if (item.type === 'video') {
      navigate(`/live/stream/${item.id}`);
    } else {
      navigate(`/live/space/${item.id}`);
    }
  };

  const toggleUI = () => {
    setShowUI(prev => !prev);
  };

  if (!currentItem || liveContent.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Radio className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">No live content available</p>
          <Button 
            variant="ghost" 
            className="mt-4 text-white"
            onClick={onClose}
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll scrollbar-hide"
        onClick={toggleUI}
      >
        {liveContent.map((item, index) => (
          <div
            key={item.id}
            className="h-[100dvh] w-full snap-start snap-always relative"
          >
            {/* Background */}
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "absolute inset-0",
                  item.type === 'space'
                    ? "bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40"
                    : "bg-gradient-to-br from-destructive/40 via-accent/30 to-primary/40"
                )}
              >
                {/* Animated elements for spaces */}
                {item.type === 'space' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex gap-1.5 items-end h-32">
                      {[...Array(20)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-2 bg-primary/60 rounded-full"
                          animate={{
                            height: ['20%', `${30 + Math.random() * 60}%`, '20%'],
                          }}
                          transition={{
                            duration: 0.5 + Math.random() * 0.5,
                            repeat: Infinity,
                            delay: i * 0.05,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Video icon for streams */}
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Radio className="w-24 h-24 text-destructive/50" />
                    </motion.div>
                  </div>
                )}
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50" />

            {/* Pulsing LIVE border */}
            <motion.div
              className="absolute inset-4 rounded-3xl border-2 border-destructive pointer-events-none"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />

            {/* UI Overlay - conditionally shown */}
            <AnimatePresence>
              {showUI && (
                <>
                  {/* Top section */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-0 left-0 right-0 p-4 pt-safe flex items-start justify-between"
                  >
                    {/* Back button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      className="bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 rounded-full w-10 h-10"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>

                    {/* Badges */}
                    <div className="flex items-center gap-2">
                      <Badge className="bg-destructive text-destructive-foreground gap-1.5 px-3 py-1.5 font-bold shadow-lg">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        LIVE
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-black/60 border-none backdrop-blur-sm"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {(item.viewer_count || 0).toLocaleString()}
                      </Badge>
                    </div>
                  </motion.div>

                  {/* Bottom section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-0 left-0 right-0 p-6 pb-safe"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Type indicator */}
                    <Badge
                      variant="outline"
                      className="mb-3 bg-black/40 border-white/20 text-white backdrop-blur-sm"
                    >
                      {item.type === 'space' ? (
                        <>
                          <Mic className="w-3 h-3 mr-1" />
                          Audio Space
                        </>
                      ) : (
                        <>
                          <Radio className="w-3 h-3 mr-1" />
                          Live Stream
                        </>
                      )}
                    </Badge>

                    {/* Topic category */}
                    {item.topic_category && (
                      <Badge
                        variant="outline"
                        className="mb-3 ml-2 bg-black/40 border-white/20 text-white backdrop-blur-sm"
                      >
                        {item.topic_category}
                      </Badge>
                    )}

                    {/* Title */}
                    <h2 className="text-white font-bold text-2xl mb-4 line-clamp-2 drop-shadow-lg">
                      {item.title}
                    </h2>

                    {/* Host info */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative">
                        <Avatar className="w-14 h-14 ring-3 ring-destructive/70">
                          <AvatarImage src={item.host.avatar_url} />
                          <AvatarFallback className="bg-primary/30 text-white text-lg">
                            {item.host.display_name?.[0] || 'H'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full border-2 border-black animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-lg">
                          {item.host.display_name}
                        </p>
                        <p className="text-white/60 text-sm">@{item.host.username}</p>
                      </div>
                    </div>

                    {/* Join button */}
                    <Button
                      className="w-full h-14 text-lg font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-3 shadow-xl rounded-2xl"
                      onClick={() => handleJoin(item)}
                    >
                      {item.type === 'space' ? (
                        <>
                          <Headphones className="w-6 h-6" />
                          Join Space
                        </>
                      ) : (
                        <>
                          <Play className="w-6 h-6 fill-current" />
                          Watch Live
                        </>
                      )}
                    </Button>

                    {/* Scroll indicator */}
                    {liveContent.length > 1 && index < liveContent.length - 1 && (
                      <motion.div
                        className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white/60"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <p className="text-xs">Swipe up for more</p>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Page indicator */}
                  {liveContent.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5"
                    >
                      {liveContent.map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 rounded-full transition-all duration-300",
                            i === index
                              ? "h-6 bg-white"
                              : "h-1.5 bg-white/40"
                          )}
                        />
                      ))}
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};
