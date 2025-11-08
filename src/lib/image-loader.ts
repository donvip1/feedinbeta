interface ImageLoaderOptions {
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  width?: number;
  height?: number;
}

export const optimizeImageUrl = (
  src: string,
  options: ImageLoaderOptions = {}
): string => {
  if (!src) return '';

  // If it's a Supabase storage URL, we can add transformation params
  if (src.includes('supabase')) {
    const url = new URL(src);
    const { quality = 85, width, height } = options;

    if (width) url.searchParams.set('width', width.toString());
    if (height) url.searchParams.set('height', height.toString());
    url.searchParams.set('quality', quality.toString());

    return url.toString();
  }

  return src;
};

export const getResponsiveImageSrcSet = (
  src: string,
  sizes: number[] = [320, 640, 768, 1024, 1280]
): string => {
  if (!src) return '';

  return sizes
    .map(size => `${optimizeImageUrl(src, { width: size })} ${size}w`)
    .join(', ');
};

export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

export const preloadImages = async (sources: string[]): Promise<void[]> => {
  return Promise.all(sources.map(preloadImage));
};
