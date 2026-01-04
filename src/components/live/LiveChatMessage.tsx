/**
 * Live Chat Message Component
 * Displays chat messages with host identification (Crown icon + Golden username)
 * TikTok/Tango inspired design
 * Clickable avatars and usernames navigate to user profiles
 */

import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LiveChatMessageProps {
  id: string;
  content: string;
  userId: string;
  hostId: string;
  profile?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
  isCompact?: boolean;
  onMentionClick?: (username: string) => void;
}

export const LiveChatMessage = ({
  id,
  content,
  userId,
  hostId,
  profile,
  isCompact = false,
  onMentionClick,
}: LiveChatMessageProps) => {
  const navigate = useNavigate();
  const isHost = userId === hostId;
  const displayName = profile?.display_name || profile?.username || 'Anonymous';

  // Navigate to user profile
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  // Highlight @mentions and make them clickable
  const renderContent = (text: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = text.split(mentionRegex);
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span 
            key={i} 
            className="text-primary font-semibold cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick?.(part);
            }}
          >
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  if (isCompact) {
    // Mobile/overlay compact style
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-2"
      >
        <Avatar 
          className={cn(
            "shrink-0 border cursor-pointer hover:scale-110 transition-transform",
            isHost ? "w-8 h-8 border-2 border-amber-400 ring-2 ring-amber-400/30" : "w-7 h-7 border-white/20"
          )}
          onClick={handleProfileClick}
        >
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback className={cn(
            "text-[10px]",
            isHost ? "bg-amber-500/50 text-amber-100" : "bg-primary/50"
          )}>
            {displayName[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className={cn(
          "backdrop-blur-sm rounded-2xl px-3 py-1.5 max-w-[85%]",
          isHost 
            ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border border-amber-400/30" 
            : "bg-black/50"
        )}>
          <div className="flex items-center gap-1.5">
            {isHost && (
              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
            )}
            <span 
              className={cn(
                "text-xs font-semibold cursor-pointer hover:underline",
                isHost ? "text-amber-400" : "text-primary"
              )}
              onClick={handleProfileClick}
            >
              {displayName}
              {isHost && <span className="ml-1 text-[10px] text-amber-300/80">• Host</span>}
            </span>
          </div>
          <p className="text-white text-sm break-words">{renderContent(content)}</p>
        </div>
      </motion.div>
    );
  }

  // Desktop/sidebar style
  return (
    <div className="flex gap-3 items-start">
      <Avatar 
        className={cn(
          "shrink-0 cursor-pointer hover:scale-110 transition-transform",
          isHost ? "w-9 h-9 border-2 border-amber-400 ring-2 ring-amber-400/20" : "w-8 h-8"
        )}
        onClick={handleProfileClick}
      >
        <AvatarImage src={profile?.avatar_url} />
        <AvatarFallback className={cn(
          "text-xs",
          isHost ? "bg-amber-500/30 text-amber-100" : "bg-primary/20"
        )}>
          {displayName[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {isHost && (
            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          <span 
            className={cn(
              "font-semibold text-sm cursor-pointer hover:underline",
              isHost ? "text-amber-400" : "text-primary"
            )}
            onClick={handleProfileClick}
          >
            {displayName}
          </span>
          {isHost && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
              Host
            </span>
          )}
        </div>
        <p className={cn(
          "text-sm break-words",
          isHost ? "text-foreground" : "text-muted-foreground"
        )}>
          {renderContent(content)}
        </p>
      </div>
    </div>
  );
};

export default LiveChatMessage;
