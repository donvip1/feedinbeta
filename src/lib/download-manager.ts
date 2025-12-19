// Custom download manager for native-like download experience

export interface DownloadProgress {
  id: string;
  fileName: string;
  fileType: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  blob?: Blob;
  objectUrl?: string;
  error?: string;
}

export type DownloadListener = (downloads: DownloadProgress[]) => void;

class DownloadManager {
  private downloads: Map<string, DownloadProgress> = new Map();
  private listeners: Set<DownloadListener> = new Set();

  subscribe(listener: DownloadListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const downloads = Array.from(this.downloads.values());
    this.listeners.forEach(listener => listener(downloads));
  }

  async downloadMedia(
    url: string,
    fileName: string,
    fileType: string,
    onProgress?: (progress: number) => void
  ): Promise<DownloadProgress> {
    const id = `download_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    const download: DownloadProgress = {
      id,
      fileName,
      fileType,
      progress: 0,
      status: 'downloading'
    };

    this.downloads.set(id, download);
    this.notify();

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength) : 0;
      const reader = response.body?.getReader();
      
      if (!reader) throw new Error('No reader available');

      const chunks: ArrayBuffer[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
        received += value.length;
        
        const progress = total ? Math.round((received / total) * 100) : Math.min(90, (received / 10000) * 100);
        download.progress = progress;
        onProgress?.(progress);
        this.notify();
      }

      const blob = new Blob(chunks, { type: fileType });
      const objectUrl = URL.createObjectURL(blob);
      
      download.progress = 100;
      download.status = 'completed';
      download.blob = blob;
      download.objectUrl = objectUrl;
      this.notify();

      // Auto-remove from active downloads after 5 seconds
      setTimeout(() => {
        this.downloads.delete(id);
        this.notify();
      }, 5000);

      return download;
    } catch (error) {
      download.status = 'error';
      download.error = error instanceof Error ? error.message : 'Download failed';
      this.notify();
      
      setTimeout(() => {
        this.downloads.delete(id);
        this.notify();
      }, 3000);
      
      throw error;
    }
  }

  async saveToDevice(blob: Blob, fileName: string): Promise<void> {
    // Use native share if available (mobile)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName)] })) {
      try {
        await navigator.share({
          files: [new File([blob], fileName, { type: blob.type })]
        });
        return;
      } catch (e) {
        // Fall through to download method
      }
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getActiveDownloads(): DownloadProgress[] {
    return Array.from(this.downloads.values());
  }

  clearDownload(id: string) {
    const download = this.downloads.get(id);
    if (download?.objectUrl) {
      URL.revokeObjectURL(download.objectUrl);
    }
    this.downloads.delete(id);
    this.notify();
  }
}

export const downloadManager = new DownloadManager();

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileExtension = (type: string): string => {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg'
  };
  return extensions[type] || 'file';
};
