import { motion, AnimatePresence } from 'framer-motion';
import { useStreamStore } from '@/stores/useStreamStore';
import { cn } from '@/lib/utils';

interface Hotzone {
  id: string;
  label: string;
  x: number; // percentage
  y: number; // percentage
  width: number;
  height: number;
  url?: string;
}

interface InteractiveCanvasProps {
  hotzones?: Hotzone[];
  onHotzoneClick?: (hotzone: Hotzone) => void;
}

export const InteractiveCanvas = ({ hotzones = [], onHotzoneClick }: InteractiveCanvasProps) => {
  const polls = useStreamStore((s) => s.polls);
  const votePoll = useStreamStore((s) => s.votePoll);

  const activePolls = polls.filter((p) => p.isActive);

  if (hotzones.length === 0 && activePolls.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Click-to-buy hotzones */}
      {hotzones.map((hz) => (
        <motion.button
          key={hz.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute pointer-events-auto"
          style={{
            left: `${hz.x}%`,
            top: `${hz.y}%`,
            width: `${hz.width}%`,
            height: `${hz.height}%`,
          }}
          onClick={() => onHotzoneClick?.(hz)}
        >
          <div className="w-full h-full rounded-xl border-2 border-white/30 bg-white/5 backdrop-blur-sm flex items-center justify-center hover:bg-white/10 transition-all">
            <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded-full">{hz.label}</span>
          </div>
        </motion.button>
      ))}

      {/* Active poll overlay */}
      <AnimatePresence>
        {activePolls.map((poll) => {
          const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
          return (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="absolute top-28 left-4 right-4 pointer-events-auto z-20"
            >
              <div className="bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 p-4">
                <p className="text-white font-bold text-sm mb-3">{poll.question}</p>
                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                    const hasVoted = !!poll.votedOptionId;
                    const isMyVote = poll.votedOptionId === opt.id;

                    return (
                      <button
                        key={opt.id}
                        onClick={() => !hasVoted && votePoll(poll.id, opt.id)}
                        disabled={hasVoted}
                        className={cn(
                          'relative w-full text-left rounded-xl overflow-hidden transition-all',
                          hasVoted ? 'cursor-default' : 'active:scale-[0.98]'
                        )}
                      >
                        <div className="relative z-10 px-4 py-2.5 flex items-center justify-between">
                          <span className={cn('text-sm font-medium', isMyVote ? 'text-white' : 'text-white/80')}>
                            {opt.text}
                          </span>
                          {hasVoted && (
                            <span className="text-white/60 text-xs font-bold">{Math.round(pct)}%</span>
                          )}
                        </div>
                        {/* Background bar */}
                        <motion.div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-xl',
                            isMyVote ? 'bg-purple-500/30' : 'bg-white/10'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: hasVoted ? `${pct}%` : 0 }}
                          transition={{ duration: 0.5 }}
                        />
                        <div className={cn(
                          'absolute inset-0 rounded-xl border',
                          isMyVote ? 'border-purple-500/50' : 'border-white/10'
                        )} />
                      </button>
                    );
                  })}
                </div>
                {totalVotes > 0 && (
                  <p className="text-white/30 text-[10px] mt-2 text-center">{totalVotes} votes</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
