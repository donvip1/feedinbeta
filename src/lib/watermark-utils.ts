/**
 * Utility functions for adding FeedIn watermark to images and videos
 */

import feedinWatermark from '@/assets/feedin-watermark.png';

/**
 * Add watermark to an image using the feedin logo icon
 * @param imageUrl - URL or data URL of the image
 * @returns Promise<Blob> - Watermarked image as a blob
 */
export const addWatermarkToImage = async (
  imageUrl: string
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    const watermarkImg = new Image();
    watermarkImg.crossOrigin = "anonymous";
    
    let imgLoaded = false;
    let watermarkLoaded = false;
    
    const tryDraw = () => {
      if (!imgLoaded || !watermarkLoaded) return;
      
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

      // Calculate watermark size (3% of image width, min 40px, max 100px)
      const watermarkSize = Math.min(100, Math.max(40, img.width * 0.08));
      const padding = Math.max(15, img.width * 0.02);
      
      // Position watermark at bottom right
      const x = img.width - watermarkSize - padding;
      const y = img.height - watermarkSize - padding;

      // Add subtle shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Draw watermark logo with slight transparency
      ctx.globalAlpha = 0.85;
      ctx.drawImage(watermarkImg, x, y, watermarkSize, watermarkSize);
      ctx.globalAlpha = 1;

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.9);
    };
    
    img.onload = () => {
      imgLoaded = true;
      tryDraw();
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    watermarkImg.onload = () => {
      watermarkLoaded = true;
      tryDraw();
    };
    
    watermarkImg.onerror = () => {
      // If watermark fails to load, still resolve without watermark
      imgLoaded = true;
      watermarkLoaded = true;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.9);
      }
    };

    img.src = imageUrl;
    watermarkImg.src = feedinWatermark;
  });
};

/**
 * Add watermark to media (image or video thumbnail) with poster info - TikTok style
 * @param mediaUrl - URL of the media
 * @param displayName - Poster's display name
 * @param username - Poster's username
 * @param mediaType - Type of media ('image' or 'video')
 * @returns Promise<Blob> - Watermarked media as a blob
 */
export const addWatermarkToMedia = async (
  mediaUrl: string,
  displayName: string,
  username: string,
  mediaType: 'image' | 'video' = 'image'
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const watermarkImg = new Image();
    watermarkImg.crossOrigin = "anonymous";
    
    const processMedia = async (sourceElement: HTMLImageElement | HTMLVideoElement, width: number, height: number) => {
      // Wait for watermark to load
      await new Promise<void>((res, rej) => {
        watermarkImg.onload = () => res();
        watermarkImg.onerror = () => res(); // Continue even if watermark fails
        watermarkImg.src = feedinWatermark;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw the media
      ctx.drawImage(sourceElement, 0, 0, width, height);

      // Add semi-transparent overlay at bottom for text readability
      const overlayHeight = height * 0.12;
      const gradient = ctx.createLinearGradient(0, height - overlayHeight * 1.5, 0, height);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - overlayHeight * 1.5, width, overlayHeight * 1.5);

      // Calculate sizes based on image dimensions
      const logoSize = Math.min(48, Math.max(28, width * 0.06));
      const padding = Math.max(12, width * 0.02);
      const fontSize = Math.min(16, Math.max(10, width * 0.025));
      const smallFontSize = Math.min(12, Math.max(8, width * 0.02));

      // Draw feedin logo at bottom left
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      if (watermarkImg.complete && watermarkImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(watermarkImg, padding, height - logoSize - padding, logoSize, logoSize);
        ctx.globalAlpha = 1;
      }

      // Draw poster info next to logo
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      
      const textX = padding + logoSize + 8;
      const textY = height - padding - logoSize / 2;
      
      // Display name
      ctx.fillText(displayName, textX, textY - 2);
      
      // Username
      ctx.font = `${smallFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`@${username}`, textX, textY + fontSize - 2);

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.92);
    };

    if (mediaType === 'video') {
      // For video, capture a frame
      const video = document.createElement('video');
      video.crossOrigin = "anonymous";
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 4);
      };

      video.onseeked = () => {
        processMedia(video, video.videoWidth, video.videoHeight);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = mediaUrl;
    } else {
      // For image
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        processMedia(img, img.width, img.height);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = mediaUrl;
    }
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
  videoUrl: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    video.preload = 'metadata';
    
    const watermarkImg = new Image();
    watermarkImg.crossOrigin = "anonymous";
    watermarkImg.src = feedinWatermark;

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

      // Calculate watermark size
      const watermarkSize = Math.min(100, Math.max(40, video.videoWidth * 0.08));
      const padding = Math.max(15, video.videoWidth * 0.02);
      const x = video.videoWidth - watermarkSize - padding;
      const y = video.videoHeight - watermarkSize - padding;

      // Add shadow and draw watermark
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(watermarkImg, x, y, watermarkSize, watermarkSize);
      ctx.globalAlpha = 1;

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
