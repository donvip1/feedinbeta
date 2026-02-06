import React from 'react';
import { MicOff, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Speaker {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
    is_verified?: boolean;
  };
}

interface TwitterSpaceUserGridProps {
  speakers: Speaker[];
  audioLevels: Record<string, number>;
  hostId: string;
  onUserClick?: (userId: string) => void;
}

export const TwitterSpaceUserGrid = ({
  speakers,
  audioLevels,
  hostId,
  onUserClick,
}: TwitterSpaceUserGridProps) => {
  // Sort: Host first, then co-hosts, then speakers, then listeners
  const sortedSpeakers = [...speakers].sort((a, b) => {
    const roleOrder = { host: 0, co_host: 1, speaker: 2, listener: 3 };
    const aOrder = a.user_id === hostId ? 0 : (roleOrder[a.role as keyof typeof roleOrder] || 3);
    const bOrder = b.user_id === hostId ? 0 : (roleOrder[b.role as keyof typeof roleOrder] || 3);
    return aOrder - bOrder;
  });

  // Limit visible users (show first 12 for grid)
  const visibleSpeakers = sortedSpeakers.slice(0, 12);

  const getRoleLabel = (speaker: Speaker) => {
    if (speaker.user_id === hostId) return 'Host';
    if (speaker.role === 'co_host') return 'Co-host';
    if (speaker.role === 'speaker') return 'Speaker';
    return 'Listener';
  };

  const isSpeaking = (userId: string) => {
    const level = audioLevels[userId] || 0;
    return level > 10; // Threshold for speaking detection
  };

  return (
    <div className="grid grid-cols-3 gap-4 max-w-[320px] mx-auto">
      {visibleSpeakers.map((speaker) => {
        const speaking = isSpeaking(speaker.user_id);
        const isHostUser = speaker.user_id === hostId;
        
        return (
          <button
            key={speaker.id}
            onClick={() => onUserClick?.(speaker.user_id)}
            className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-zinc-900/50 transition-colors"
          >
            <div className="relative">
              {/* Speaking ring animation */}
              <div
                className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  speaking && "ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-950 animate-pulse"
                )}
              />
              
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-zinc-700">
                {speaker.profile?.avatar_url ? (
                  <img 
                    src={speaker.profile.avatar_url} 
                    alt={speaker.profile.display_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xl font-semibold">
                    {speaker.profile?.display_name?.[0] || 'U'}
                  </div>
                )}
              </div>
              
              {/* Muted indicator */}
              {speaker.is_muted && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-950">
                  <MicOff className="w-3 h-3 text-zinc-400" />
                </div>
              )}
            </div>

            {/* Name and role */}
            <div className="text-center max-w-full">
              <div className="flex items-center justify-center gap-1 max-w-full">
                <span className="text-white text-xs font-medium truncate max-w-[60px]">
                  {speaker.profile?.display_name?.split(' ')[0] || 'User'}
                </span>
                {speaker.profile?.is_verified && (
                  <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                )}
              </div>
              <span className={cn(
                "text-[10px]",
                isHostUser ? "text-purple-400" : "text-zinc-500"
              )}>
                {getRoleLabel(speaker)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
