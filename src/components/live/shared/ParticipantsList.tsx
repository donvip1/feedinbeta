import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MicOff, Mic, Lock, Unlock, UserPlus, Users, Shield, Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Participant as ContextParticipant, ParticipantRole } from '@/context/UnifiedLiveContext';

// Re-export for backward compatibility
export type Participant = ContextParticipant;

interface ParticipantsListProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomType: 'video_broadcast' | 'audio_space' | 'pk_battle';
  isHost: boolean;
  participants: Participant[];
  onMuteParticipant?: (userId: string) => void;
  onUnmuteParticipant?: (userId: string) => void;
  onMuteAll?: () => void;
  onInviteUser?: () => void;
  onPromoteToSpeaker?: (userId: string) => void;
  onDemoteToListener?: (userId: string) => void;
}

export const ParticipantsList = ({
  isOpen,
  onClose,
  roomId,
  roomType,
  isHost,
  participants,
  onMuteParticipant,
  onUnmuteParticipant,
  onMuteAll,
  onInviteUser,
  onPromoteToSpeaker,
  onDemoteToListener,
}: ParticipantsListProps) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  const speakers = participants.filter(p => p.role !== 'listener');
  const listeners = participants.filter(p => p.role === 'listener');

  const handleMuteToggle = (participant: Participant) => {
    if (participant.is_hard_muted) {
      onUnmuteParticipant?.(participant.user_id);
    } else {
      onMuteParticipant?.(participant.user_id);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'host':
        return <Badge variant="default" className="bg-amber-500 text-xs"><Crown className="w-2.5 h-2.5 mr-1" />Host</Badge>;
      case 'co_host':
        return <Badge variant="default" className="bg-purple-500 text-xs"><Shield className="w-2.5 h-2.5 mr-1" />Co-Host</Badge>;
      case 'speaker':
        return <Badge variant="secondary" className="text-xs"><Mic className="w-2.5 h-2.5 mr-1" />Speaker</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Listener</Badge>;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl max-h-[80vh] overflow-hidden"
        >
          {/* Handle Bar */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">
                Participants ({participants.length})
              </h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Host Actions */}
          {isHost && (
            <div className="flex gap-2 px-4 py-3 border-b bg-muted/30">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onMuteAll}
                className="flex-1"
              >
                <MicOff className="w-4 h-4 mr-2" />
                Mute All
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={onInviteUser}
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            </div>
          )}

          <ScrollArea className="h-[50vh] px-4 py-3">
            {/* Speakers/Co-Hosts Section */}
            {speakers.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                  {roomType === 'audio_space' ? 'Speakers' : 'On Stage'} ({speakers.length})
                </h4>
                <div className="space-y-2">
                  {speakers.map((participant) => (
                    <ParticipantRow
                      key={participant.id}
                      participant={participant}
                      isHost={isHost}
                      currentUserId={user?.id}
                      onMuteToggle={handleMuteToggle}
                      onDemote={onDemoteToListener}
                      getRoleBadge={getRoleBadge}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Listeners Section */}
            {listeners.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                  Listeners ({listeners.length})
                </h4>
                <div className="space-y-2">
                  {listeners.map((participant) => (
                    <ParticipantRow
                      key={participant.id}
                      participant={participant}
                      isHost={isHost}
                      currentUserId={user?.id}
                      onMuteToggle={handleMuteToggle}
                      onPromote={onPromoteToSpeaker}
                      getRoleBadge={getRoleBadge}
                    />
                  ))}
                </div>
              </div>
            )}

            {participants.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No participants yet</p>
                <p className="text-sm text-muted-foreground/70">Invite people to join!</p>
              </div>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

interface ParticipantRowProps {
  participant: Participant;
  isHost: boolean;
  currentUserId?: string;
  onMuteToggle: (participant: Participant) => void;
  onPromote?: (userId: string) => void;
  onDemote?: (userId: string) => void;
  getRoleBadge: (role: string) => React.ReactNode;
}

const ParticipantRow = ({
  participant,
  isHost,
  currentUserId,
  onMuteToggle,
  onPromote,
  onDemote,
  getRoleBadge,
}: ParticipantRowProps) => {
  const isCurrentUser = participant.user_id === currentUserId;
  const isParticipantHost = participant.role === 'host';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl",
        "bg-muted/30 hover:bg-muted/50 transition-colors",
        participant.is_speaking && "ring-2 ring-emerald-500"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className={cn(
            "w-10 h-10",
            participant.is_speaking && "ring-2 ring-emerald-400"
          )}>
            <AvatarImage src={participant.profile?.avatar_url} />
            <AvatarFallback>
              {participant.profile?.display_name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          {participant.is_speaking && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"
            >
              <Mic className="w-2.5 h-2.5 text-white" />
            </motion.div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">
              {participant.profile?.display_name || 'User'}
              {isCurrentUser && <span className="text-muted-foreground ml-1">(You)</span>}
            </p>
          </div>
          {getRoleBadge(participant.role)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Mute/Unmute (Host only, not for host themselves) */}
        {isHost && !isParticipantHost && !isCurrentUser && (
          <Button
            variant={participant.is_hard_muted ? "destructive" : "secondary"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onMuteToggle(participant)}
          >
            {participant.is_hard_muted ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* Promote to Speaker (for listeners) */}
        {isHost && participant.role === 'listener' && onPromote && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPromote(participant.user_id)}
          >
            <Mic className="w-3 h-3 mr-1" />
            Invite
          </Button>
        )}

        {/* Demote to Listener (for speakers) */}
        {isHost && participant.role === 'speaker' && onDemote && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDemote(participant.user_id)}
          >
            <MicOff className="w-3 h-3 mr-1" />
            Remove
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default ParticipantsList;
