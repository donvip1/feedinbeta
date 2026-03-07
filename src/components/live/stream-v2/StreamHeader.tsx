import { Share2, MoreHorizontal, Minimize2, Gift } from 'lucide-react';
import { AICatchUpPanel } from './AICatchUpPanel';

interface StreamHeaderProps {
  streamId: string;
  streamTitle: string;
  host: any;
  isHost: boolean;
  viewerCount: number;
  viewers: any[];
  onHostProfile: () => void;
  onViewGuests: () => void;
  onGift: () => void;
  onShare: () => void;
  onSettings: () => void;
  onMinimize: () => void;
  onEnd: () => void;
}

const formatNumber = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString();

export const StreamHeader = ({
  streamId,
  streamTitle,
  host,
  isHost,
  viewerCount,
  viewers,
  onHostProfile,
  onViewGuests,
  onGift,
  onShare,
  onSettings,
  onMinimize,
  onEnd,
}: StreamHeaderProps) => {
  return (
    <div
      className="absolute top-0 left-0 right-0 px-4 py-3 flex justify-between items-center z-40 pt-safe"
      style={{ transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      {/* Left: Host info */}
      <button
        onClick={onHostProfile}
        className="flex items-center gap-2.5 min-w-0 active:scale-95 transition-transform duration-75"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-rose-500 shrink-0">
          {host?.avatar_url ? (
            <img src={host.avatar_url} alt={host?.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-rose-500/30 flex items-center justify-center text-white text-xs font-black">
              {host?.display_name?.[0] || 'H'}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-white leading-tight truncate">{streamTitle || 'Live Stream'}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onViewGuests(); }}
            className="text-[11px] text-white/50 font-medium flex items-center gap-1 active:opacity-70 transition-opacity"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {formatNumber(viewerCount)} watching
            {viewers.slice(0, 3).map((v: any, i: number) => (
              <img
                key={v.user_id}
                src={v.profile?.avatar_url || ''}
                alt=""
                className="w-4 h-4 rounded-full border border-black/50 -ml-1"
                style={{ zIndex: 3 - i }}
              />
            ))}
            {viewers.length > 3 && (
              <span className="text-[9px] text-white/40 ml-0.5">+{viewers.length - 3}</span>
            )}
          </button>
        </div>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <AICatchUpPanel streamId={streamId} />

        <button
          onClick={onGift}
          className="w-7 h-7 bg-amber-500/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-amber-500/30 active:scale-90 transition-all"
        >
          <Gift className="w-3 h-3 text-amber-400" />
        </button>

        <button
          onClick={onShare}
          className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
        >
          <Share2 className="w-3 h-3 text-white" />
        </button>

        <button
          onClick={onSettings}
          className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
        >
          <MoreHorizontal className="w-3 h-3 text-white" />
        </button>

        <button
          onClick={onMinimize}
          className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all"
        >
          <Minimize2 className="w-3 h-3 text-white" />
        </button>

        <button
          onClick={onEnd}
          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-full text-white text-xs font-bold active:scale-90 transition-all"
        >
          {isHost ? 'End' : 'Leave'}
        </button>
      </div>
    </div>
  );
};
