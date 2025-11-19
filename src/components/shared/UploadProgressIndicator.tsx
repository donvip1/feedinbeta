import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, CheckCircle, XCircle } from 'lucide-react';

interface UploadProgressIndicatorProps {
  progress: number;
  isUploading: boolean;
  isComplete: boolean;
  hasError: boolean;
  fileName?: string;
}

export const UploadProgressIndicator = ({
  progress,
  isUploading,
  isComplete,
  hasError,
  fileName,
}: UploadProgressIndicatorProps) => {
  if (!isUploading && !isComplete && !hasError) return null;

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isUploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            {isComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
            {hasError && <XCircle className="w-4 h-4 text-destructive" />}
            <span className="text-sm font-medium">
              {isUploading && 'Uploading...'}
              {isComplete && 'Upload complete'}
              {hasError && 'Upload failed'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>

        {fileName && (
          <p className="text-xs text-muted-foreground truncate">{fileName}</p>
        )}

        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
};
