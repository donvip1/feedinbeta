import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Camera, Trophy } from 'lucide-react';
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

const ANGLE_ICONS: Record<number, React.ElementType> = {
  0: Users,
  1: Camera,
  2: Trophy,
};

export const POVSwitcher = ({ angles, onSelectAngle }: POVSwitcherProps) => {
  const activeAngleId = useStreamStore((s) => s.activeAngleId);
  const setActiveAngleId = useStreamStore((s) => s.setActiveAngleId);

  if (angles.length <= 1) return null;

  const handleSelect = (id: string) => {
    setActiveAngleId(id);
    onSelectAngle(id);
  };

  return (
    <div className="absolute bottom-24 right-4 z-30 flex flex-col gap-4 pointer-events-auto">
      {angles.map((angle, index) => {
        const Icon = ANGLE_ICONS[index] || Camera;
        const isActive = (activeAngleId || angles[0]?.id) === angle.id;

        return (
          <motion.button
            key={angle.id}
            onClick={() => handleSelect(angle.id)}
            whileTap={{ scale: 0.9 }}
            className={cn(
              'w-14 h-14 rounded-2xl border-2 transition-all flex items-center justify-center backdrop-blur-3xl',
              isActive
                ? 'border-yellow-400 bg-yellow-400/20 scale-110 shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                : 'border-white/10 bg-black/40'
            )}
          >
            <Icon size={20} className={isActive ? 'text-yellow-400' : 'text-white/60'} />
          </motion.button>
        );
      })}
    </div>
  );
};
