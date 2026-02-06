import React from 'react';
import { ArrowLeft, Settings, Hand } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TwitterSpaceHeaderProps {
  onBack: () => void;
  onSettings: () => void;
  onLeave: () => void;
  isHost: boolean;
  raisedHandsCount?: number;
  onViewQueue?: () => void;
}

export const TwitterSpaceHeader = ({
  onBack,
  onSettings,
  onLeave,
  isHost,
  raisedHandsCount = 0,
  onViewQueue,
}: TwitterSpaceHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-950">
      <button onClick={onBack} className="p-2 text-white hover:bg-zinc-800 rounded-full transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3">
        {/* Raised hands indicator for host */}
        {isHost && raisedHandsCount > 0 && (
          <button 
            onClick={onViewQueue}
            className="relative p-2 text-amber-500 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <Hand className="w-5 h-5" />
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-amber-500 text-black font-bold"
            >
              {raisedHandsCount}
            </Badge>
          </button>
        )}
        
        <button 
          onClick={onSettings} 
          className="p-2 text-white hover:bg-zinc-800 rounded-full transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
        
        <button
          onClick={onLeave}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-full transition-colors"
        >
          {isHost ? 'End' : 'Leave'}
        </button>
      </div>
    </div>
  );
};
