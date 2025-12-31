import { Radio, Users, Mic, Play, Headphones } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface InlineLiveCardProps {
  item: {
    id: string;
    title: string;
    type: 'video' | 'space';
    status: string;
    viewer_count: number;
    thumbnail_url?: string;
    topic_category?: string;
    host: {
      display_name: string;
      username: string;
      avatar_url: string;
    };
  };
  onClick: () => void;
}

export const InlineLiveCard = ({ item, onClick }: InlineLiveCardProps) => {
  const isSpace = item.type === 'space';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer group",
        "border-2 border-red-500/50 shadow-lg shadow-red-500/20"
      )}
    >
      {/* Background */}
      {item.thumbnail_url ? (
        <img 
          src={item.thumbnail_url} 
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className={cn(
          "absolute inset-0",
          isSpace 
            ? "bg-gradient-to-br from-primary/30 via-purple-600/20 to-accent/30"
            : "bg-gradient-to-br from-red-500/30 via-pink-500/20 to-purple-500/30"
        )}>
          {/* Animated wave pattern for spaces */}
          {isSpace && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1 items-end h-24">
                {[...Array(16)].map((_, i) => (
                  <motion.div 
                    key={i}
                    className="w-1.5 bg-primary/60 rounded-full"
                    animate={{ 
                      height: ['20%', `${30 + Math.random() * 50}%`, '20%'] 
                    }}
                    transition={{ 
                      duration: 0.5 + Math.random() * 0.5,
                      repeat: Infinity,
                      delay: i * 0.05
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Video icon for streams */}
          {!isSpace && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-16 h-16 text-red-500/40 animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/40" />

      {/* Pulsing LIVE border effect */}
      <div className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-pulse opacity-50" />

      {/* Live badge - prominent */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <Badge className="bg-red-500 text-white gap-1 px-3 py-1.5 font-bold shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </Badge>
        <Badge variant="secondary" className="gap-1 bg-black/60 border-none backdrop-blur-sm">
          {isSpace ? <Mic className="w-3 h-3" /> : <Radio className="w-3 h-3" />}
          {isSpace ? 'Space' : 'Stream'}
        </Badge>
      </div>

      {/* Viewer count */}
      <div className="absolute top-3 right-3">
        <Badge variant="secondary" className="gap-1 bg-black/60 border-none backdrop-blur-sm">
          <Users className="w-3 h-3" />
          {(item.viewer_count || 0).toLocaleString()}
        </Badge>
      </div>

      {/* Content info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* Topic category */}
        {item.topic_category && (
          <Badge variant="outline" className="mb-2 bg-black/40 border-white/20 text-white text-xs backdrop-blur-sm">
            {item.topic_category}
          </Badge>
        )}

        {/* Title */}
        <h3 className="text-white font-bold text-lg mb-3 line-clamp-2 drop-shadow-lg">
          {item.title}
        </h3>

        {/* Host info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Avatar className="w-10 h-10 ring-2 ring-red-500/70">
              <AvatarImage src={item.host.avatar_url} />
              <AvatarFallback className="bg-primary/20">{item.host.display_name?.[0] || 'H'}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{item.host.display_name}</p>
            <p className="text-white/60 text-xs truncate">@{item.host.username}</p>
          </div>
        </div>

        {/* Join button */}
        <Button 
          className="w-full h-12 text-base font-bold bg-red-500 hover:bg-red-600 text-white gap-2 shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {isSpace ? (
            <>
              <Headphones className="w-5 h-5" />
              Join Space
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              Watch Live
            </>
          )}
        </Button>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.div>
  );
};