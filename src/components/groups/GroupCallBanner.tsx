import React from 'react';
import { Phone, Video, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveGroupCall } from '@/hooks/useGroupCall';
import { formatDistanceToNow } from 'date-fns';

interface GroupCallBannerProps {
  call: ActiveGroupCall;
  onJoin: () => void;
  isConnected: boolean;
}

export const GroupCallBanner: React.FC<GroupCallBannerProps> = ({
  call,
  onJoin,
  isConnected,
}) => {
  const duration = formatDistanceToNow(new Date(call.startedAt), { addSuffix: false });

  return (
    <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4 mx-4 mt-2 animate-pulse-slow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
            {call.callType === 'video' ? (
              <Video className="w-5 h-5 text-green-500" />
            ) : (
              <Phone className="w-5 h-5 text-green-500" />
            )}
          </div>
          <div>
            <p className="font-medium text-green-600 dark:text-green-400">
              {call.callType === 'video' ? 'Video Call' : 'Voice Call'} in progress
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{call.participantCount} participant{call.participantCount !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{duration}</span>
            </div>
          </div>
        </div>

        {!isConnected && (
          <Button
            onClick={onJoin}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            Join
          </Button>
        )}
      </div>
    </div>
  );
};
