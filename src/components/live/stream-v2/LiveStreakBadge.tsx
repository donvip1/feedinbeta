import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveStreakBadgeProps {
  count: number;
  className?: string;
}

export const LiveStreakBadge = ({ count, className }: LiveStreakBadgeProps) => {
  if (count <= 0) return null;

  const color =
    count >= 8 ? 'text-purple-400' :
    count >= 4 ? 'text-red-400' :
    'text-orange-400';

  const bgColor =
    count >= 8 ? 'bg-purple-500/20' :
    count >= 4 ? 'bg-red-500/20' :
    'bg-orange-500/20';

  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold', bgColor, color, className)}>
      <Flame className="w-2.5 h-2.5" />
      {count}
    </span>
  );
};
