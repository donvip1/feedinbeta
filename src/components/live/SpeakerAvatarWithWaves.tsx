import { Crown, Gift, Mic, MicOff, MoreVertical, Shield, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    sm: 'w-14 h-14',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };

  const avatarInnerClasses = {
    sm: 'w-12 h-12',
    md: 'w-[4.5rem] h-[4.5rem]',
    lg: 'w-[5.5rem] h-[5.5rem]',
  };

  const isSpeaking = !speaker.is_muted && !speaker.host_muted && audioLevel > 2;
  const isSelf = speaker.user_id === currentUserId;
  const canShowHostControls = isHost && !isSelf && speaker.role !== 'host';

  return (
    <div className="flex flex-col items-center gap-4 group">
      <div className="relative">
        {/* Ping-style wave borders */}
        {isSpeaking && (
          <>
            <div 
              className="absolute -inset-4 rounded-[2.5rem] border-2 border-purple-500/30 opacity-50"
              style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}
            />
            <div 
              className="absolute -inset-2 rounded-[2.5rem] border-2 border-purple-500/50"
              style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}
            />
          </>
        )}
        
        {/* Avatar with gradient border */}
        <motion.div
          animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0 }}
          onClick={onProfileClick}
          className={cn(
            "p-1 bg-gradient-to-tr transition-all duration-500 cursor-pointer",
            sizeClasses[size],
            isSpeaking 
              ? 'from-purple-500 to-pink-500 scale-105' 
              : speaker.is_muted 
              ? 'from-white/10 to-white/5' 
              : 'from-green-500/50 to-emerald-500/50'
          )}
          style={{ borderRadius: '2.2rem' }}
        >
          <img 
            src={speaker.profile?.avatar_url || ''} 
            alt={speaker.profile?.display_name || 'User'}
            className="w-full h-full object-cover bg-slate-900 border-2 border-[#050505]"
            style={{ borderRadius: '1.9rem' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(speaker.profile?.display_name || 'U')}&background=6366f1&color=fff`;
            }}
          />
        </motion.div>

        {/* Microbadge indicators */}
        <div className="absolute -bottom-1 -right-1 flex gap-1">
          {showCrown && speaker.role === 'host' && (
            <div className="bg-amber-400 p-1.5 shadow-xl border-2 border-[#050505]" style={{ borderRadius: '0.75rem' }}>
              <Crown className="w-3 h-3 text-black fill-current" />
            </div>
          )}
          {isSpeaking && (
            <div className="bg-purple-600 p-1.5 shadow-xl border-2 border-[#050505] animate-bounce" style={{ borderRadius: '0.75rem' }}>
              <Volume2 className="w-3 h-3 text-white" />
            </div>
          )}
          {!isSpeaking && (
            <div className={cn(
              "p-1.5 shadow-xl border-2 border-[#050505]",
              speaker.is_muted ? "bg-red-500" : "bg-green-500"
            )} style={{ borderRadius: '0.75rem' }}>
              {speaker.is_muted ? (
                <MicOff className="w-3 h-3 text-white" />
              ) : (
                <Mic className="w-3 h-3 text-white" />
              )}
            </div>
          )}
        </div>

        {/* Host muted indicator */}
        {speaker.host_muted && (
          <div className="absolute -top-1 -left-1 rounded-xl p-1 bg-red-500 z-20 border-2 border-[#050505]">
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
            "text-xs font-black truncate max-w-[90px] group-hover:text-purple-400 transition-colors",
            onProfileClick && "cursor-pointer"
          )}
          onClick={onProfileClick}
        >
          {speaker.profile?.display_name || 'User'}
        </p>
        <p className={cn(
          "text-[8px] font-black uppercase tracking-widest",
          speaker.role === 'host' ? 'text-amber-400' : 
          speaker.role === 'co_host' ? 'text-purple-400' : 'text-slate-500'
        )}>
          {speaker.role === 'host' ? 'Host' : 
           speaker.role === 'co_host' ? 'Co-host' : 
           speaker.role === 'speaker' ? 'Speaker' : ''}
        </p>
      </div>

      {/* Gift button on hover */}
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity border-white/10 text-white/60 hover:text-white"
        onClick={onGift}
      >
        <Gift className="w-3 h-3 mr-1" />
        Gift
      </Button>
    </div>
  );
};
