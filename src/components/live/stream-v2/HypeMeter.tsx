import { motion } from 'framer-motion';
import { useStreamStore } from '@/stores/useStreamStore';

export const HypeMeter = () => {
  const hype = useStreamStore(s => s.hypeLevel);

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
      <div className="w-48 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10 backdrop-blur-md">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-500 via-yellow-400 to-pink-500"
          animate={{ width: `${hype}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        />
      </div>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Hype Meter</p>
    </div>
  );
};
