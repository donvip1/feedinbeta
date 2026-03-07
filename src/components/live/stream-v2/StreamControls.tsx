import { Heart, Gift, Coins, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PKParticipant } from '../unified/PKBattleBar';

interface StreamControlsProps {
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onSubmit: () => void;
  onReact: () => void;
  onRefill: () => void;
  onGift?: () => void;
  isPKMode: boolean;
  battleParticipants: PKParticipant[];
  interactionTargetId: string;
  onSetTarget: (id: string) => void;
}

export const StreamControls = ({
  replyText,
  onReplyTextChange,
  onSubmit,
  onReact,
  onRefill,
  onGift,
  isPKMode,
  battleParticipants,
  interactionTargetId,
  onSetTarget,
}: StreamControlsProps) => {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 p-3 pb-safe bg-gradient-to-t from-black/80 via-black/40 to-transparent z-40"
      style={{ transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      {/* PK target selector */}
      {isPKMode && battleParticipants.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => onSetTarget('all')}
            className={cn(
              'text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all',
              interactionTargetId === 'all'
                ? 'bg-white text-black'
                : 'bg-black/50 text-gray-400 border border-white/10'
            )}
          >
            ALL
          </button>
          {battleParticipants.map((p) => (
            <button
              key={p.id}
              onClick={() => onSetTarget(p.id)}
              className={cn(
                'text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition-all',
                interactionTargetId === p.id
                  ? 'bg-white text-black'
                  : 'bg-black/50 text-gray-400 border border-white/10'
              )}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Chat input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center bg-black/60 backdrop-blur-3xl border border-white/10 rounded-full overflow-hidden focus-within:border-yellow-400 transition-all">
            <input
              type="text"
              value={replyText}
              onChange={(e) => onReplyTextChange(e.target.value)}
              placeholder="Message the arena..."
              className="flex-1 min-w-0 bg-transparent text-xs font-medium text-white placeholder-white/30 focus:outline-none px-3 py-2"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-30 shrink-0 transition-colors"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </form>

        {/* React */}
        <button
          onClick={onReact}
          className="w-8 h-8 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all shrink-0"
        >
          <Heart className="w-3.5 h-3.5 text-rose-400" />
        </button>

        {/* Refill credits */}
        <button
          onClick={onRefill}
          className="w-8 h-8 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all shrink-0"
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
        </button>

        {/* Gift — reduced by 30% from w-12 to ~w-8.5, using w-9 */}
        <button
          onClick={onGift}
          className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <Gift className="w-4 h-4 text-white" fill="currentColor" />
        </button>
      </div>
    </div>
  );
};
