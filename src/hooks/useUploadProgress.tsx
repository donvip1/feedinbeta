import { useState } from 'react';

export interface UploadProgress {
  progress: number;
  isUploading: boolean;
  error: string | null;
}

export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>({
    progress: 0,
    isUploading: false,
    error: null,
  });

  const startUpload = () => {
    setProgress({ progress: 0, isUploading: true, error: null });
  };

  const updateProgress = (value: number) => {
    setProgress(prev => ({ ...prev, progress: Math.min(100, Math.max(0, value)) }));
  };

  const completeUpload = () => {
    setProgress({ progress: 100, isUploading: false, error: null });
  };

  const failUpload = (error: string) => {
    setProgress({ progress: 0, isUploading: false, error });
  };

  const resetProgress = () => {
    setProgress({ progress: 0, isUploading: false, error: null });
  };

  return {
    progress: progress.progress,
    isUploading: progress.isUploading,
    error: progress.error,
    startUpload,
    updateProgress,
    completeUpload,
    failUpload,
    resetProgress,
  };
}
