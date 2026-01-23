import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Users, Compass } from 'lucide-react';

export type FeedMode = 'forYou' | 'following' | 'explore';

interface FeedModeSelectorProps {
  activeMode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
  className?: string;
  showLabels?: boolean;
}

const feedModes: { id: FeedMode; label: string; icon: React.ReactNode }[] = [
  { id: 'forYou', label: 'For You', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'following', label: 'Following', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'explore', label: 'Explore', icon: <Compass className="w-3.5 h-3.5" /> },
];

export const FeedModeSelector: React.FC<FeedModeSelectorProps> = ({
  activeMode,
  onModeChange,
  className,
  showLabels = true,
}) => {
  return (
    <div className={cn(
      "flex items-center justify-center gap-1 p-1 rounded-full bg-muted/50 backdrop-blur-sm",
      className
    )}>
      {feedModes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
            activeMode === mode.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {mode.icon}
          {showLabels && <span>{mode.label}</span>}
        </button>
      ))}
    </div>
  );
};

export default FeedModeSelector;
