import { useState } from 'react';
import { videoUploadManager, UploadProgress } from '@/lib/video-upload-manager';

export const useVideoUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (file: File, userId: string): Promise<string | null> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress({ loaded: 0, total: 0, percentage: 0 });

    try {
      const result = await videoUploadManager.uploadVideo(
        file,
        userId,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (result.error) {
        setError(result.error);
        return null;
      }

      return result.url;
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setIsUploading(false);
    setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
    setError(null);
  };

  return {
    uploadVideo,
    isUploading,
    uploadProgress,
    error,
    resetUpload,
  };
};
