import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  isVisible: boolean;
  label?: string;
}

export function ProgressBar({ progress, isVisible, label = 'Uploading' }: ProgressBarProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-6 w-[90%] max-w-md">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-foreground font-medium">{label}...</span>
        </div>
        <Progress value={progress} className="h-2 mb-2" />
        <p className="text-center text-sm text-muted-foreground">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}
