import watermarkImage from '@/assets/feedin-watermark.png';

interface StickerData {
  emoji: string;
  x: number;
  y: number;
  scale: number;
}

interface DrawingPath {
  x: number;
  y: number;
}

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
    textPosition?: number; // 0-100 percentage
    textSize?: number; // Font size in px
    stickers?: StickerData[];
    rotation?: number;
    blur?: number; // Blur amount in px
    drawingPaths?: DrawingPath[][]; // Array of paths
    drawColor?: string; // Drawing color
    drawSize?: number; // Drawing line width
  },
  username?: string
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
      const blur = effects.blur || 0;
      
      const filterParts = [];
      if (effects.filter) {
        // Parse and apply preset filter
        filterParts.push(effects.filter);
      }
      filterParts.push(`brightness(${brightness}%)`);
      filterParts.push(`contrast(${contrast}%)`);
      filterParts.push(`saturate(${saturation}%)`);
      if (blur > 0) {
        filterParts.push(`blur(${blur}px)`);
      }
      
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
        const fontSize = effects.textSize || 48;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';

        // Calculate Y position based on percentage (default 50% for center)
        const positionPercent = effects.textPosition !== undefined ? effects.textPosition : 50;
        const y = (positionPercent / 100) * canvas.height;

        ctx.strokeText(effects.textOverlay, canvas.width / 2, y);
        ctx.fillText(effects.textOverlay, canvas.width / 2, y);
      }

      // Add stickers if specified
      if (effects.stickers && effects.stickers.length > 0) {
        effects.stickers.forEach((sticker) => {
          const fontSize = 80 * sticker.scale;
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const x = (sticker.x / 100) * canvas.width;
          const y = (sticker.y / 100) * canvas.height;
          
          // Add shadow for better visibility
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText(sticker.emoji, x, y);
          
          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        });
      }

      // Add drawing paths if specified
      if (effects.drawingPaths && effects.drawingPaths.length > 0) {
        ctx.strokeStyle = effects.drawColor || '#ffffff';
        ctx.lineWidth = effects.drawSize || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        effects.drawingPaths.forEach((path) => {
          if (path.length < 2) return;
          
          ctx.beginPath();
          const firstPoint = path[0];
          ctx.moveTo((firstPoint.x / 100) * canvas.width, (firstPoint.y / 100) * canvas.height);
          
          for (let i = 1; i < path.length; i++) {
            const point = path[i];
            ctx.lineTo((point.x / 100) * canvas.width, (point.y / 100) * canvas.height);
          }
          
          ctx.stroke();
        });
      }

      // Add watermark with username (TikTok style)
      const watermark = new Image();
      watermark.crossOrigin = 'anonymous';
      watermark.onload = () => {
        // Random position for watermark
        const positions = [
          { x: 20, y: 20, align: 'left' }, // top left
          { x: canvas.width - 20, y: 20, align: 'right' }, // top right
          { x: 20, y: canvas.height / 2, align: 'left' }, // center left
          { x: canvas.width - 20, y: canvas.height / 2, align: 'right' }, // center right
          { x: 20, y: canvas.height - 60, align: 'left' }, // bottom left
          { x: canvas.width - 20, y: canvas.height - 60, align: 'right' }, // bottom right
        ];
        const randomPos = positions[Math.floor(Math.random() * positions.length)];

        // Draw watermark logo (40px height)
        const logoHeight = 40;
        const logoWidth = (watermark.width / watermark.height) * logoHeight;
        
        let logoX = randomPos.x;
        if (randomPos.align === 'right') {
          logoX = randomPos.x - logoWidth;
        }
        
        ctx.drawImage(watermark, logoX, randomPos.y, logoWidth, logoHeight);

        // Draw username below watermark
        if (username) {
          ctx.font = 'bold 16px Arial';
          ctx.fillStyle = 'white';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          ctx.textAlign = randomPos.align as CanvasTextAlign;
          
          const textY = randomPos.y + logoHeight + 18;
          ctx.strokeText(`@${username}`, randomPos.x, textY);
          ctx.fillText(`@${username}`, randomPos.x, textY);
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

      watermark.onerror = () => {
        // If watermark fails to load, proceed without it
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.95);
      };

      watermark.src = watermarkImage;
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