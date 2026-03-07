import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PKParticipant } from '../unified/PKBattleBar';

interface VideoEngineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasVideo: boolean;
  isCameraOn: boolean;
  isHost: boolean;
  isPKMode: boolean;
  pkMaxSlots: number;
  battleParticipants: PKParticipant[];
  focusedParticipantId: string | null;
  host: any;
  onParticipantTap: (id: string) => void;
  onInvite: () => void;
}

export const VideoEngine = ({
  videoRef,
  hasVideo,
  isCameraOn,
  isHost,
  isPKMode,
  pkMaxSlots,
  battleParticipants,
  focusedParticipantId,
  host,
  onParticipantTap,
  onInvite,
}: VideoEngineProps) => {
  const PK_COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

  const renderPKFeed = (p: PKParticipant, isFocused: boolean, isMini: boolean) => {
    const isHostParticipant = p.id === host?.id;
    return (
      <div
        key={p.id}
        onClick={() => onParticipantTap(p.id)}
        className={cn(
          'relative overflow-hidden cursor-pointer transition-all duration-300',
          isFocused ? 'absolute inset-0 z-0' : '',
          isMini ? 'w-24 h-32 rounded-xl border-2 shadow-xl z-30 shrink-0' : 'w-full h-full'
        )}
        style={{
          borderColor: isMini ? p.color : undefined,
          backgroundColor: !isHostParticipant ? p.color + '33' : undefined,
        }}
      >
        {isHostParticipant && isCameraOn ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: p.color + '22' }}>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black text-white/80"
              style={{ backgroundColor: p.color + '44' }}
            >
              {p.name[0]}
            </div>
            <span className="text-white/60 text-sm font-bold mt-2">{p.name}</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 z-10">
          <span className="text-[10px] font-black text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
            SCORE: {p.score.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
      {isPKMode && battleParticipants.length > 0 ? (
        focusedParticipantId === null ? (
          <div className={cn(
            'w-full h-full grid gap-[1px]',
            pkMaxSlots <= 2 ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-2'
          )}>
            {battleParticipants.map((p) => renderPKFeed(p, false, false))}
            {Array.from({ length: pkMaxSlots - battleParticipants.length }).map((_, i) => (
              <div key={`empty-${i}`} className="relative bg-black/90 flex flex-col items-center justify-center gap-3 border border-white/5">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Users className="w-8 h-8 text-white/20" />
                </div>
                {isHost && (
                  <button onClick={onInvite} className="text-[10px] font-bold bg-white/5 px-3 py-1 rounded-full text-white/60">
                    Invite PK
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="relative w-full h-full">
            {battleParticipants.find((p) => p.id === focusedParticipantId) &&
              renderPKFeed(battleParticipants.find((p) => p.id === focusedParticipantId)!, true, false)}
            <div className="absolute bottom-32 right-3 flex flex-col gap-2 z-30">
              {battleParticipants.filter((p) => p.id !== focusedParticipantId).map((p) => renderPKFeed(p, false, true))}
            </div>
          </div>
        )
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isHost}
            className={cn('w-full h-full object-cover', !hasVideo && 'hidden')}
          />
          {!hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
              <div className="flex flex-col items-center gap-4">
                {host?.avatar_url ? (
                  <img src={host.avatar_url} alt={host?.display_name} className="w-28 h-28 rounded-full ring-4 ring-rose-500/50" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-4xl font-black ring-4 ring-rose-500/50">
                    {host?.display_name?.[0] || 'H'}
                  </div>
                )}
                <p className="text-white/40 text-sm font-medium">Waiting for video...</p>
              </div>
            </div>
          )}
        </>
      )}
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
    </div>
  );
};
