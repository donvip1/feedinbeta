import { Crown, Gift, Mic, MicOff, MoreVertical, Shield, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Speaker {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  hand_raised_at?: string | null;
  host_muted?: boolean;
  mic_allowed?: boolean;
  joined_at?: string | null;
  left_at?: string | null;
  space_id?: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

interface SpeakerAvatarWithWavesProps {
  speaker: Speaker;
  isHost: boolean;
  currentUserId?: string;
  audioLevel: number;
  onGift: () => void;
  onHostMute?: () => void;
  onHostUnmute?: () => void;
  onToggleMicPermission?: (allowed: boolean) => void;
  onRemove?: () => void;
  onProfileClick?: () => void;
  size: 'sm' | 'md' | 'lg';
  showCrown?: boolean;
}

export const SpeakerAvatarWithWaves = ({ 
  speaker, 
  isHost, 
  currentUserId,
  audioLevel, 
  onGift, 
  onHostMute,
  onHostUnmute,
  onToggleMicPermission,
  onRemove,
  onProfileClick,
  size, 
  showCrown 
}: SpeakerAvatarWithWavesProps) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const wavesSizeClasses = {
    sm: { inner: 'w-14 h-14', middle: 'w-16 h-16', outer: 'w-18 h-18' },
    md: { inner: 'w-20 h-20', middle: 'w-24 h-24', outer: 'w-28 h-28' },
    lg: { inner: 'w-24 h-24', middle: 'w-28 h-28', outer: 'w-32 h-32' },
  };

  // More sensitive speaking detection - threshold of 5 (was 0.1 which was wrong)
  // audioLevel is 0-100 from the analyzer
  const isSpeaking = !speaker.is_muted && audioLevel > 5;
  const isSelf = speaker.user_id === currentUserId;
  const canShowHostControls = isHost && !isSelf && speaker.role !== 'host';
  
  // Normalize audio level for animations (0-1 range, with amplification for visual effect)
  // audioLevel is 0-100, normalize to 0-1
  const normalizedLevel = Math.min(audioLevel / 50, 1);

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative flex items-center justify-center">
        {/* Animated audio wave rings */}
        {isSpeaking && (
          <>
            {/* Outer ring - slowest, largest */}
            <motion.div
              className={cn(
                "absolute rounded-full border-2 border-primary/20",
                wavesSizeClasses[size].outer
              )}
              animate={{
                scale: [1, 1.15 + normalizedLevel * 0.15],
                opacity: [0.4, 0],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            
            {/* Middle ring - medium speed */}
            <motion.div
              className={cn(
                "absolute rounded-full border-2 border-primary/40",
                wavesSizeClasses[size].middle
              )}
              animate={{
                scale: [1, 1.1 + normalizedLevel * 0.1],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.15,
              }}
            />
            
            {/* Inner ring - fastest, most visible */}
            <motion.div
              className={cn(
                "absolute rounded-full border-2 border-primary/60",
                wavesSizeClasses[size].inner
              )}
              animate={{
                scale: [1, 1.05 + normalizedLevel * 0.05],
                opacity: [0.8, 0.2],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.3,
              }}
            />

            {/* Glow effect behind avatar */}
            <motion.div
              className={cn(
                "absolute rounded-full bg-primary/20 blur-md",
                sizeClasses[size]
              )}
              animate={{
                scale: [1, 1.2 + normalizedLevel * 0.3],
                opacity: [0.5 + normalizedLevel * 0.3, 0.2],
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
          </>
        )}
        
        {/* Avatar with dynamic ring */}
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.2, repeat: isSpeaking ? Infinity : 0 }}
          onClick={onProfileClick}
          className={onProfileClick ? "cursor-pointer" : ""}
        >
          <Avatar className={cn(
            sizeClasses[size],
            "ring-4 transition-all relative z-10",
            isSpeaking 
              ? "ring-primary shadow-lg shadow-primary/40" 
              : speaker.is_muted 
              ? "ring-muted" 
              : "ring-green-500/50",
            onProfileClick && "hover:ring-primary/70"
          )}>
            <AvatarImage src={speaker.profile?.avatar_url || ''} />
            <AvatarFallback className="text-lg font-bold">
              {speaker.profile?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        {/* Crown for hosts */}
        {showCrown && speaker.role === 'host' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
            <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
        )}

        {/* Mute indicator */}
        <motion.div 
          className={cn(
            "absolute -bottom-1 -right-1 rounded-full p-1 z-20",
            speaker.is_muted ? "bg-red-500" : "bg-green-500"
          )}
          animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.3, repeat: isSpeaking ? Infinity : 0 }}
        >
          {speaker.is_muted ? (
            <MicOff className="w-3 h-3 text-white" />
          ) : (
            <Mic className="w-3 h-3 text-white" />
          )}
        </motion.div>

        {/* Host muted indicator */}
        {speaker.host_muted && (
          <div className="absolute -top-1 -left-1 rounded-full p-1 bg-red-500 z-20">
            <Shield className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Actions dropdown for hosts */}
        {canShowHostControls && (
          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary" className="w-6 h-6 rounded-full">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onGift}>
                  <Gift className="w-4 h-4 mr-2" />
                  Send Gift
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {speaker.host_muted ? (
                  <DropdownMenuItem onClick={onHostUnmute}>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Allow to Unmute
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onHostMute}>
                    <VolumeX className="w-4 h-4 mr-2" />
                    Mute User
                  </DropdownMenuItem>
                )}
                {speaker.mic_allowed ? (
                  <DropdownMenuItem onClick={() => onToggleMicPermission?.(false)}>
                    <MicOff className="w-4 h-4 mr-2" />
                    Revoke Mic Permission
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onToggleMicPermission?.(true)}>
                    <Mic className="w-4 h-4 mr-2" />
                    Grant Mic Permission
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onRemove} className="text-destructive">
                  <X className="w-4 h-4 mr-2" />
                  Remove from stage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="text-center">
        <p 
          className={cn(
            "text-xs font-medium truncate max-w-[80px]",
            onProfileClick && "cursor-pointer hover:text-primary"
          )}
          onClick={onProfileClick}
        >
          {speaker.profile?.display_name || 'User'}
        </p>
        
        {/* Role badge */}
        {speaker.role !== 'listener' && speaker.role !== 'speaker' && (
          <Badge variant="secondary" className="text-[10px] h-4 mt-0.5">
            {speaker.role === 'host' ? 'Host' : 'Co-host'}
          </Badge>
        )}
        
        {/* Mute status text - visible to everyone */}
        <div className="flex items-center justify-center gap-1 mt-0.5">
          {speaker.host_muted ? (
            <span className="text-[10px] text-red-400 flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" />
              Host muted
            </span>
          ) : speaker.is_muted ? (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MicOff className="w-2.5 h-2.5" />
              Muted
            </span>
          ) : (
            <span className="text-[10px] text-green-400 flex items-center gap-0.5">
              <Mic className="w-2.5 h-2.5" />
              Speaking
            </span>
          )}
        </div>
      </div>

      {/* Gift button on hover */}
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onGift}
      >
        <Gift className="w-3 h-3 mr-1" />
        Gift
      </Button>
    </div>
  );
};
