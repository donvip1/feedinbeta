/**
 * Compress images before upload
 */
export const compressImage = async (file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not compress image'));
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
    };
    reader.onerror = () => reject(new Error('Could not read file'));
  });
};

/**
 * Extract video thumbnail at specific time
 */
export const extractVideoThumbnail = (videoFile: File, timeInSeconds: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timeInSeconds, video.duration);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(video.src);
      resolve(thumbnail);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not load video'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
};

/**
 * Extract multiple video thumbnails
 */
export const extractVideoThumbnails = async (videoFile: File, count: number = 10): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (count + 1);
      const thumbnails: string[] = [];

      for (let i = 1; i <= count; i++) {
        try {
          const time = i * interval;
          const thumbnail = await new Promise<string>((res, rej) => {
            video.currentTime = time;
            video.onseeked = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 160;
              canvas.height = 90;

              const ctx = canvas.getContext('2d');
              if (!ctx) {
                rej(new Error('Could not get canvas context'));
                return;
              }

              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              res(canvas.toDataURL('image/jpeg', 0.5));
            };
          });
          thumbnails.push(thumbnail);
        } catch (error) {
          console.error('Error extracting thumbnail:', error);
        }
      }

      URL.revokeObjectURL(video.src);
      resolve(thumbnails);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not load video'));
    };

    video.src = URL.createObjectURL(videoFile);
  });
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

/**
 * Check if compression is recommended
 */
export const shouldCompressImage = (file: File): boolean => {
  const maxSize = 2 * 1024 * 1024; // 2MB
  return file.type.startsWith('image/') && file.size > maxSize;
};
