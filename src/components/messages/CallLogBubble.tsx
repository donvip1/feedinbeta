import React from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Video, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallLogBubbleProps {
  callType: 'voice' | 'video';
  callStatus: 'answered' | 'missed' | 'declined' | 'ended';
  duration?: number; // in seconds
  isOutgoing: boolean;
  createdAt: string;
  isOwn: boolean;
}

export const CallLogBubble = ({
  callType,
  callStatus,
  duration,
  isOutgoing,
  createdAt,
  isOwn,
}: CallLogBubbleProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
  };

  const getCallIcon = () => {
    if (callStatus === 'missed') {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    if (callStatus === 'declined') {
      return <PhoneOff className="w-4 h-4 text-red-500" />;
    }
    if (callType === 'video') {
      return isOutgoing 
        ? <Video className="w-4 h-4 text-emerald-500" />
        : <Video className="w-4 h-4 text-emerald-500" />;
    }
    return isOutgoing 
      ? <PhoneOutgoing className="w-4 h-4 text-emerald-500" />
      : <PhoneIncoming className="w-4 h-4 text-emerald-500" />;
  };

  const getCallText = () => {
    const typeLabel = callType === 'video' ? 'Video call' : 'Voice call';
    
    if (callStatus === 'missed') {
      return isOutgoing ? `${typeLabel} - No answer` : `Missed ${typeLabel.toLowerCase()}`;
    }
    if (callStatus === 'declined') {
      return isOutgoing ? `${typeLabel} - Declined` : `Declined ${typeLabel.toLowerCase()}`;
    }
    if (callStatus === 'answered' || callStatus === 'ended') {
      return typeLabel;
    }
    return typeLabel;
  };

  const getStatusColor = () => {
    if (callStatus === 'missed' || callStatus === 'declined') {
      return 'text-red-500';
    }
    return 'text-emerald-500';
  };

  const isMissedOrDeclined = callStatus === 'missed' || callStatus === 'declined';

  return (
    <div className={cn(
      "flex gap-2",
      isOwn ? 'flex-row-reverse' : 'flex-row'
    )}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl max-w-[280px]",
        isOwn
          ? "bg-primary/10 border border-primary/20"
          : "bg-card border border-border/50",
      )}>
        {/* Call Icon */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          isMissedOrDeclined ? "bg-red-500/10" : "bg-emerald-500/10"
        )}>
          {getCallIcon()}
        </div>

        {/* Call Info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium text-sm",
            getStatusColor()
          )}>
            {getCallText()}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {duration && duration > 0 && (
              <>
                <Clock className="w-3 h-3" />
                <span>{formatDuration(duration)}</span>
                <span>•</span>
              </>
            )}
            <span>{formatTime(createdAt)}</span>
          </div>
        </div>

        {/* Arrow indicator */}
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center",
          isMissedOrDeclined ? "bg-red-500/10" : "bg-emerald-500/10"
        )}>
          {isOutgoing ? (
            <PhoneOutgoing className={cn("w-3 h-3", isMissedOrDeclined ? "text-red-500" : "text-emerald-500")} />
          ) : (
            <PhoneIncoming className={cn("w-3 h-3", isMissedOrDeclined ? "text-red-500" : "text-emerald-500")} />
          )}
        </div>
      </div>
    </div>
  );
};
