import { motion } from 'framer-motion';
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
    <div className="absolute bottom-32 right-3 z-30 flex flex-col gap-2 pointer-events-auto">
      {angles.map((angle, index) => {
        const Icon = ANGLE_ICONS[index] || Camera;
        const isActive = (activeAngleId || angles[0]?.id) === angle.id;

        return (
          <motion.button
            key={angle.id}
            onClick={() => handleSelect(angle.id)}
            whileTap={{ scale: 0.9 }}
            className={cn(
              'w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center backdrop-blur-3xl',
              isActive
                ? 'border-yellow-400 bg-yellow-400/20 scale-110 shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                : 'border-white/10 bg-black/40'
            )}
          >
            <Icon size={16} className={isActive ? 'text-yellow-400' : 'text-white/60'} />
          </motion.button>
        );
      })}
    </div>
  );
};
