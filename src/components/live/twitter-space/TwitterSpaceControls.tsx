import React from 'react';
import { Mic, MicOff, Users, Heart, MessageCircle, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TwitterSpaceControlsProps {
  isMicOn: boolean;
  onMicToggle: () => void;
  onGuestsClick: () => void;
  onReactionsClick: () => void;
  onChatClick: () => void;
  unreadCount: number;
  canSpeak: boolean;
  hasRaisedHand: boolean;
  onGiftClick?: () => void;
  isHost?: boolean;
}

export const TwitterSpaceControls = ({
  isMicOn,
  onMicToggle,
  onGuestsClick,
  onReactionsClick,
  onChatClick,
  unreadCount,
  canSpeak,
  hasRaisedHand,
  onGiftClick,
  isHost,
}: TwitterSpaceControlsProps) => {
  return (
    <div className="px-4 py-4 pb-safe bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800/50">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {/* Mic / Request Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onMicToggle}
            className={cn(
              "w-14 h-14 rounded-full border flex items-center justify-center transition-all",
              canSpeak
                ? isMicOn
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500"
                : hasRaisedHand
                  ? "bg-amber-600 border-amber-500 text-white"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500"
            )}
          >
            {canSpeak ? (
              isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />
            ) : (
              <span className="text-lg">✋</span>
            )}
          </button>
          <span className="text-xs text-zinc-500">
            {canSpeak ? (isMicOn ? 'Mute' : 'Unmute') : hasRaisedHand ? 'Lower' : 'Request'}
          </span>
        </div>

        {/* Center Icons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onReactionsClick}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <Heart className="w-6 h-6" />
          </button>

          {onGiftClick && (
            <button
              onClick={onGiftClick}
              className="p-2 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Gift className="w-6 h-6" />
            </button>
          )}

        </div>

        {/* Chat Button with Badge */}
        <button
          onClick={onChatClick}
          className="relative px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center gap-2 transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <Badge className="bg-white text-purple-600 text-xs px-1.5 py-0.5 font-bold">
              {unreadCount}
            </Badge>
          )}
        </button>
      </div>
    </div>
  );
};
