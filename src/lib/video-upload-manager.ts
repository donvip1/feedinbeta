import { supabase } from '@/integrations/supabase/client';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class VideoUploadManager {
  private static instance: VideoUploadManager;

  private constructor() {}

  static getInstance(): VideoUploadManager {
    if (!VideoUploadManager.instance) {
      VideoUploadManager.instance = new VideoUploadManager();
    }
    return VideoUploadManager.instance;
  }

  async uploadVideo(
    file: File,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ url: string; error?: string }> {
    try {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        return { url: '', error: 'File must be a video' };
      }

      // Check file size (max 150MB for free users, can be adjusted)
      const maxSize = 150 * 1024 * 1024; // 150MB
      if (file.size > maxSize) {
        return { url: '', error: 'Video size must be less than 150MB' };
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Use XMLHttpRequest for real progress tracking
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        return { url: '', error: 'Not authenticated' };
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/post-videos/${fileName}`;

      const result = await new Promise<{ url: string; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('post-videos')
              .getPublicUrl(fileName);
            resolve({ url: publicUrl });
          } else {
            resolve({ url: '', error: `Upload failed with status ${xhr.status}` });
          }
        });

        xhr.addEventListener('error', () => {
          resolve({ url: '', error: 'Network error during upload' });
        });

        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(file);
      });

      return result;

    } catch (error: any) {
      console.error('Video upload failed:', error);
      return { url: '', error: error.message };
    }
  }

  async deleteVideo(videoUrl: string): Promise<boolean> {
    try {
      // Extract file path from URL
      const urlParts = videoUrl.split('/post-videos/');
      if (urlParts.length < 2) return false;

      const filePath = urlParts[1];
      const { error } = await supabase.storage
        .from('post-videos')
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Video deletion failed:', error);
      return false;
    }
  }

  getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
      };

      video.src = URL.createObjectURL(file);
    });
  }

  async trimVideo(
    file: File,
    startTime: number,
    endTime: number
  ): Promise<Blob> {
    // This is a placeholder - actual video trimming would require a library like ffmpeg.wasm
    // For now, return the original file
    console.log('Video trimming requested:', { startTime, endTime });
    return file;
  }
}

export const videoUploadManager = VideoUploadManager.getInstance();
