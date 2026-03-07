import { Share2, MoreHorizontal, Minimize2, ShoppingBag } from 'lucide-react';
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
      className="absolute top-0 left-0 right-0 px-4 py-3 flex justify-between items-start z-40 pt-safe"
      style={{ transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      {/* Left: Host info */}
      <button
        onClick={onHostProfile}
        className="flex items-center gap-2.5 min-w-0 active:scale-95 transition-transform duration-75 bg-black/40 backdrop-blur-3xl p-2 pr-5 rounded-full border border-white/10"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-400 p-0.5 shrink-0">
          {host?.avatar_url ? (
            <img src={host.avatar_url} alt={host?.display_name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <div className="w-full h-full bg-neutral-800 rounded-full flex items-center justify-center text-white text-xs font-black">
              {host?.display_name?.[0] || 'H'}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white leading-tight truncate tracking-tight">{host?.display_name || 'Host'}</span>
            <span className="bg-red-500 px-1.5 py-0.5 rounded text-[8px] font-black text-white">LIVE</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onViewGuests(); }}
            className="text-[10px] text-white/50 font-bold flex items-center gap-1.5 active:opacity-70 transition-opacity"
          >
            {formatNumber(viewerCount)} watching
          </button>
        </div>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <AICatchUpPanel streamId={streamId} />

        <button
          onClick={onGift}
          className="px-5 h-10 bg-white/10 backdrop-blur-3xl rounded-full flex items-center justify-center font-black text-xs uppercase tracking-widest border border-white/10 text-white active:scale-95 transition-all"
        >
          Shop
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
