/**
 * Apply effects to an image using Canvas API
 */
export async function applyImageEffects(
  imageUrl: string,
  effects: {
    filter?: string;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    textOverlay?: string;
    textPosition?: 'top' | 'center' | 'bottom';
    selectedSticker?: string;
    rotation?: number;
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Apply rotation if specified
      if (effects.rotation) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((effects.rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      // Apply CSS filters
      const brightness = effects.brightness || 100;
      const contrast = effects.contrast || 100;
      const saturation = effects.saturation || 100;
      
      const filterParts = [];
      if (effects.filter) {
        // Parse and apply preset filter
        filterParts.push(effects.filter);
      }
      filterParts.push(`brightness(${brightness}%)`);
      filterParts.push(`contrast(${contrast}%)`);
      filterParts.push(`saturate(${saturation}%)`);
      
      ctx.filter = filterParts.join(' ');

      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Reset filter for overlays
      ctx.filter = 'none';

      if (effects.rotation) {
        ctx.restore();
      }

      // Add text overlay if specified
      if (effects.textOverlay && effects.textOverlay.trim()) {
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';

        let y = canvas.height / 2;
        if (effects.textPosition === 'top') y = 80;
        if (effects.textPosition === 'bottom') y = canvas.height - 80;

        ctx.strokeText(effects.textOverlay, canvas.width / 2, y);
        ctx.fillText(effects.textOverlay, canvas.width / 2, y);
      }

      // Add sticker if specified
      if (effects.selectedSticker) {
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(effects.selectedSticker, canvas.width / 2, canvas.height / 2);
      }

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/jpeg', 0.95);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Upload processed media to Supabase storage
 */
export async function uploadProcessedMedia(
  blob: Blob,
  userId: string,
  mediaType: 'image' | 'video'
): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  const fileExt = mediaType === 'image' ? 'jpg' : 'mp4';
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const bucketName = mediaType === 'image' ? 'post-images' : 'post-videos';

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, blob, {
      contentType: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return publicUrl;
}
