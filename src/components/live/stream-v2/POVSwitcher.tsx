import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStreamStore } from '@/stores/useStreamStore';

interface CameraAngle {
  id: string;
  label: string;
  thumbnailUrl?: string;
  participantName?: string;
  isActive: boolean;
}

interface POVSwitcherProps {
  angles: CameraAngle[];
  onSelectAngle: (angleId: string) => void;
}

export const POVSwitcher = ({ angles, onSelectAngle }: POVSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeAngleId = useStreamStore((s) => s.activeAngleId);
  const setActiveAngleId = useStreamStore((s) => s.setActiveAngleId);

  if (angles.length <= 1) return null;

  const handleSelect = (id: string) => {
    setActiveAngleId(id);
    onSelectAngle(id);
    setIsOpen(false);
  };

  return (
    <div className="absolute bottom-40 right-3 z-30">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-xl border transition-all active:scale-90',
          isOpen
            ? 'bg-white/20 border-white/30'
            : 'bg-black/40 border-white/10'
        )}
      >
        <LayoutGrid className="w-4 h-4 text-white" />
      </button>

      {/* Thumbnail rail */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute bottom-12 right-0 flex flex-col gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10"
          >
            {angles.map((angle) => (
              <button
                key={angle.id}
                onClick={() => handleSelect(angle.id)}
                className={cn(
                  'relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-all active:scale-95',
                  (activeAngleId || angles[0]?.id) === angle.id
                    ? 'border-rose-500 ring-1 ring-rose-500/50'
                    : 'border-white/10'
                )}
              >
                {angle.thumbnailUrl ? (
                  <img src={angle.thumbnailUrl} alt={angle.label} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <span className="text-white/40 text-[10px] font-bold">{angle.label}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                  <span className="text-[8px] text-white/80 font-medium truncate block">{angle.label}</span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
