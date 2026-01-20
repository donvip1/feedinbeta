export interface CompressionOptions {
  quality: 'low' | 'medium' | 'high';
  onProgress?: (progress: number) => void;
}

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
}

const QUALITY_SETTINGS = {
  low: { maxWidth: 480, maxHeight: 480, videoBitsPerSecond: 500000 },
  medium: { maxWidth: 720, maxHeight: 720, videoBitsPerSecond: 1000000 },
  high: { maxWidth: 1080, maxHeight: 1080, videoBitsPerSecond: 2000000 },
};

export async function compressVideo(
  file: File,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { quality, onProgress } = options;
  const settings = QUALITY_SETTINGS[quality];
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;

    video.onloadedmetadata = async () => {
      try {
        // Calculate target dimensions maintaining aspect ratio
        let targetWidth = video.videoWidth;
        let targetHeight = video.videoHeight;

        if (targetWidth > settings.maxWidth) {
          const ratio = settings.maxWidth / targetWidth;
          targetWidth = settings.maxWidth;
          targetHeight = Math.round(targetHeight * ratio);
        }

        if (targetHeight > settings.maxHeight) {
          const ratio = settings.maxHeight / targetHeight;
          targetHeight = settings.maxHeight;
          targetWidth = Math.round(targetWidth * ratio);
        }

        // Ensure even dimensions for video encoding
        targetWidth = Math.round(targetWidth / 2) * 2;
        targetHeight = Math.round(targetHeight / 2) * 2;

        // Create canvas for frame processing
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d')!;

        // Get canvas stream
        const stream = canvas.captureStream(30); // 30 fps

        // Check for audio track and add if exists
        try {
          // Create audio context to extract audio
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaElementSource(video);
          const destination = audioCtx.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioCtx.destination);
          
          destination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        } catch (audioError) {
          console.log('No audio track or audio extraction failed:', audioError);
        }

        // Determine supported mime type
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
        
        let selectedMimeType = 'video/webm';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }

        // Create media recorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: settings.videoBitsPerSecond,
        });

        const chunks: Blob[] = [];
        const duration = video.duration;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          URL.revokeObjectURL(videoUrl);
          const blob = new Blob(chunks, { type: selectedMimeType.split(';')[0] });
          resolve({
            blob,
            originalSize,
            compressedSize: blob.size,
          });
        };

        mediaRecorder.onerror = (e) => {
          URL.revokeObjectURL(videoUrl);
          reject(new Error('MediaRecorder error: ' + e));
        };

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms

        // Play video and draw frames to canvas
        video.currentTime = 0;
        await video.play();

        const drawFrame = () => {
          if (video.paused || video.ended) {
            mediaRecorder.stop();
            return;
          }

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Update progress
          if (onProgress && duration) {
            const progress = Math.min(Math.round((video.currentTime / duration) * 100), 99);
            onProgress(progress);
          }

          requestAnimationFrame(drawFrame);
        };

        drawFrame();

        // Handle video end
        video.onended = () => {
          if (onProgress) onProgress(100);
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 100);
        };

      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video'));
    };
  });
}
