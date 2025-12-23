// Audio Stream Manager for Live Spaces
// Handles audio processing, recording, and level monitoring

export interface AudioStreamConfig {
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioRecordingChunk {
  data: Blob;
  timestamp: number;
}

class AudioStreamManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: AudioRecordingChunk[] = [];
  private isRecording = false;
  private analyzerNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  // Get default audio constraints
  getDefaultConstraints(): MediaStreamConstraints {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    };
  }

  // Initialize audio context
  async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  // Get user media stream
  async getUserMedia(config?: AudioStreamConfig): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: config?.echoCancellation ?? true,
        noiseSuppression: config?.noiseSuppression ?? true,
        autoGainControl: config?.autoGainControl ?? true,
        sampleRate: config?.sampleRate ?? 48000,
      },
      video: false,
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.mediaStream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw error;
    }
  }

  // Create audio analyzer for level monitoring
  createAnalyzer(stream: MediaStream): AnalyserNode {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 256;
    this.analyzerNode.smoothingTimeConstant = 0.8;
    
    source.connect(this.analyzerNode);
    
    return this.analyzerNode;
  }

  // Get current audio level (0-100)
  getAudioLevel(): number {
    if (!this.analyzerNode) return 0;
    
    const dataArray = new Uint8Array(this.analyzerNode.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.analyzerNode.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return Math.min(100, average * 1.5);
  }

  // Start recording
  startRecording(stream?: MediaStream): void {
    const targetStream = stream || this.mediaStream;
    if (!targetStream) {
      throw new Error('No media stream available for recording');
    }

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(targetStream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push({
          data: event.data,
          timestamp: Date.now(),
        });
      }
    };

    this.mediaRecorder.start(1000); // Capture every second
    this.isRecording = true;
  }

  // Stop recording and get blob
  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(
          this.recordedChunks.map(chunk => chunk.data),
          { type: 'audio/webm;codecs=opus' }
        );
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  // Get recording chunks for incremental upload
  getRecordingChunks(): AudioRecordingChunk[] {
    return [...this.recordedChunks];
  }

  // Clear recording chunks
  clearRecordingChunks(): void {
    this.recordedChunks = [];
  }

  // Set volume (0-1)
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // Mute/unmute stream
  setMuted(muted: boolean): void {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  // Check if currently recording
  getIsRecording(): boolean {
    return this.isRecording;
  }

  // Get current stream
  getStream(): MediaStream | null {
    return this.mediaStream;
  }

  // Stop and cleanup
  cleanup(): void {
    // Stop recording
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyzerNode = null;
    this.gainNode = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  // Convert blob to base64 for storage
  async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data URL prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Merge multiple audio blobs
  async mergeAudioBlobs(blobs: Blob[]): Promise<Blob> {
    return new Blob(blobs, { type: 'audio/webm;codecs=opus' });
  }
}

// Singleton instance
export const audioStreamManager = new AudioStreamManager();

// Audio level monitor utility
export class AudioLevelMonitor {
  private analyzer: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private animationFrame: number | null = null;
  private callback: (level: number) => void;

  constructor(analyzer: AnalyserNode, callback: (level: number) => void) {
    this.analyzer = analyzer;
    this.dataArray = new Uint8Array(analyzer.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.callback = callback;
  }

  start(): void {
    const monitor = () => {
      this.analyzer.getByteFrequencyData(this.dataArray);
      const average = Array.from(this.dataArray).reduce((sum, val) => sum + val, 0) / this.dataArray.length;
      this.callback(Math.min(100, average * 1.5));
      this.animationFrame = requestAnimationFrame(monitor);
    };
    monitor();
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}

// Speaking indicator component helper
export const getSpeakingIntensity = (level: number): 'none' | 'low' | 'medium' | 'high' => {
  if (level < 10) return 'none';
  if (level < 30) return 'low';
  if (level < 60) return 'medium';
  return 'high';
};

// Audio quality presets
export const AudioQualityPresets = {
  low: { sampleRate: 22050, bitrate: 64000 },
  medium: { sampleRate: 44100, bitrate: 128000 },
  high: { sampleRate: 48000, bitrate: 192000 },
} as const;
