/**
 * Utility functions for adding FeedIn watermark to images and videos
 */

/**
 * Add watermark to an image
 * @param imageUrl - URL or data URL of the image
 * @param watermarkText - Text to display as watermark (default: "FeedIn")
 * @returns Promise<Blob> - Watermarked image as a blob
 */
export const addWatermarkToImage = async (
  imageUrl: string,
  watermarkText: string = "FeedIn"
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Configure watermark style
      const fontSize = Math.max(20, img.width * 0.03);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      
      // Add shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Measure text
      const textMetrics = ctx.measureText(watermarkText);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      // Position watermark at bottom right with padding
      const padding = Math.max(10, img.width * 0.02);
      const x = img.width - textWidth - padding;
      const y = img.height - padding;

      // Draw text stroke
      ctx.strokeText(watermarkText, x, y);
      // Draw text fill
      ctx.fillText(watermarkText, x, y);

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.9);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
};

/**
 * Add watermark to a video by overlaying it during upload
 * Note: This creates a thumbnail with watermark. For video watermarking during playback,
 * you would typically use a video processing service or FFmpeg
 * 
 * @param videoUrl - URL or data URL of the video
 * @param watermarkText - Text to display as watermark (default: "FeedIn")
 * @returns Promise<string> - Data URL of watermarked thumbnail
 */
export const addWatermarkToVideoThumbnail = async (
  videoUrl: string,
  watermarkText: string = "FeedIn"
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      // Seek to 1 second to get a good thumbnail
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame
      ctx.drawImage(video, 0, 0);

      // Add watermark
      const fontSize = Math.max(20, video.videoWidth * 0.03);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const textMetrics = ctx.measureText(watermarkText);
      const textWidth = textMetrics.width;
      const padding = Math.max(10, video.videoWidth * 0.02);
      const x = video.videoWidth - textWidth - padding;
      const y = video.videoHeight - padding;

      ctx.strokeText(watermarkText, x, y);
      ctx.fillText(watermarkText, x, y);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = videoUrl;
  });
};

/**
 * Check if watermark should be applied based on user preferences
 * @param userId - User ID to check preferences
 * @returns Promise<boolean> - Whether to apply watermark
 */
export const shouldApplyWatermark = async (userId: string): Promise<boolean> => {
  // For now, watermark is always applied
  // In future, this can check user preferences from database
  return true;
};
