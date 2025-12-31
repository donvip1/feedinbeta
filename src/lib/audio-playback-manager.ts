/**
 * Audio Playback Manager
 * 
 * Centralized audio playback management for Live Spaces.
 * Ensures reliable audio playback with proper handling of:
 * - Browser autoplay policies
 * - Audio element lifecycle
 * - Volume and output device management
 * - Robust error recovery
 * 
 * Inspired by Zoom/Twitter Spaces audio reliability patterns.
 */

class AudioPlaybackManager {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 1.0;
  private outputDeviceId: string = 'default';
  private onPlaybackStarted: (() => void) | null = null;
  private onPlaybackError: ((error: Error) => void) | null = null;
  private hasUserInteraction: boolean = false;
  private pendingStreams: Map<string, MediaStream> = new Map();

  constructor() {
    // Listen for user interaction to enable audio
    this.setupUserInteractionListeners();
  }

  private setupUserInteractionListeners() {
    const enableAudio = () => {
      this.hasUserInteraction = true;
      console.log('[AudioPlayback] User interaction detected - audio enabled');
      
      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Play any pending streams
      this.playPendingStreams();
      
      // Remove listeners after first interaction
      document.removeEventListener('click', enableAudio, true);
      document.removeEventListener('touchstart', enableAudio, true);
      document.removeEventListener('keydown', enableAudio, true);
    };

    document.addEventListener('click', enableAudio, true);
    document.addEventListener('touchstart', enableAudio, true);
    document.addEventListener('keydown', enableAudio, true);
  }

  private async playPendingStreams() {
    for (const [peerId, stream] of this.pendingStreams.entries()) {
      console.log('[AudioPlayback] Playing pending stream for:', peerId);
      await this.playStream(peerId, stream);
    }
    this.pendingStreams.clear();
  }

  /**
   * Initialize audio context for advanced audio processing
   */
  initializeContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      this.masterGainNode.gain.value = this.volume;
      
      console.log('[AudioPlayback] Audio context initialized, state:', this.audioContext.state);
    }
    
    // Resume if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  /**
   * Play a remote audio track
   */
  async playTrack(peerId: string, track: MediaStreamTrack): Promise<boolean> {
    console.log('[AudioPlayback] 🔊 Playing track for peer:', peerId, {
      kind: track.kind,
      readyState: track.readyState,
      enabled: track.enabled,
      muted: track.muted,
    });

    if (track.readyState !== 'live') {
      console.warn('[AudioPlayback] Track is not live, cannot play');
      return false;
    }

    const stream = new MediaStream([track]);
    return this.playStream(peerId, stream);
  }

  /**
   * Play a media stream
   */
  async playStream(peerId: string, stream: MediaStream): Promise<boolean> {
    console.log('[AudioPlayback] 🔊 Playing stream for peer:', peerId);

    // If no user interaction yet, queue for later
    if (!this.hasUserInteraction) {
      console.log('[AudioPlayback] No user interaction yet, queuing stream');
      this.pendingStreams.set(peerId, stream);
      return true;
    }

    // Remove existing audio for this peer
    this.stopPeer(peerId);

    try {
      const audio = document.createElement('audio');
      audio.id = `space-audio-${peerId}-${Date.now()}`;
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.srcObject = stream;
      audio.volume = this.isMuted ? 0 : this.volume;
      audio.muted = false; // Don't use HTML muted attribute, control via volume

      // Position off-screen but keep in DOM for reliable playback
      audio.style.cssText = `
        position: fixed;
        left: -9999px;
        top: -9999px;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      `;

      document.body.appendChild(audio);
      this.audioElements.set(peerId, audio);

      // Set output device if supported
      if (this.outputDeviceId !== 'default' && 'setSinkId' in audio) {
        try {
          await (audio as any).setSinkId(this.outputDeviceId);
        } catch (e) {
          console.warn('[AudioPlayback] Failed to set output device:', e);
        }
      }

      // Attempt to play with retry logic
      let playAttempts = 0;
      const maxAttempts = 3;

      const attemptPlay = async (): Promise<boolean> => {
        playAttempts++;
        try {
          await audio.play();
          console.log('[AudioPlayback] ✅ Playing audio for peer:', peerId);
          this.onPlaybackStarted?.();
          return true;
        } catch (err: any) {
          console.warn(`[AudioPlayback] Play attempt ${playAttempts} failed:`, err.name);
          
          if (err.name === 'NotAllowedError' && playAttempts < maxAttempts) {
            // Wait a bit and retry
            await new Promise(r => setTimeout(r, 100));
            return attemptPlay();
          }
          
          if (err.name === 'NotAllowedError') {
            // Queue for later when user interacts
            this.pendingStreams.set(peerId, stream);
            console.log('[AudioPlayback] Queued for user interaction');
          }
          
          return false;
        }
      };

      const success = await attemptPlay();

      // Set up track lifecycle handlers
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        
        track.onended = () => {
          console.log('[AudioPlayback] Track ended for peer:', peerId);
          this.stopPeer(peerId);
        };

        track.onmute = () => {
          console.log('[AudioPlayback] Track muted for peer:', peerId);
        };

        track.onunmute = () => {
          console.log('[AudioPlayback] Track unmuted for peer:', peerId);
          audio.play().catch(() => {});
        };
      }

      return success;
    } catch (error) {
      console.error('[AudioPlayback] ❌ Error setting up audio:', error);
      this.onPlaybackError?.(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    }
  }

  /**
   * Stop playback for a specific peer
   */
  stopPeer(peerId: string) {
    const audio = this.audioElements.get(peerId);
    if (audio) {
      console.log('[AudioPlayback] Stopping audio for peer:', peerId);
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.audioElements.delete(peerId);
    }

    // Also remove from pending
    this.pendingStreams.delete(peerId);

    // Clean up any orphaned elements
    document.querySelectorAll(`[id*="space-audio-${peerId}"]`).forEach(el => {
      el.remove();
    });
  }

  /**
   * Set master mute state
   */
  setMuted(muted: boolean) {
    this.isMuted = muted;
    console.log('[AudioPlayback] Master mute:', muted);

    this.audioElements.forEach(audio => {
      audio.volume = muted ? 0 : this.volume;
    });

    if (this.masterGainNode) {
      this.masterGainNode.gain.value = muted ? 0 : this.volume;
    }
  }

  /**
   * Get mute state
   */
  getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Set master volume (0.0 - 1.0)
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (!this.isMuted) {
      this.audioElements.forEach(audio => {
        audio.volume = this.volume;
      });

      if (this.masterGainNode) {
        this.masterGainNode.gain.value = this.volume;
      }
    }
  }

  /**
   * Set output device (loudspeaker/earpiece)
   */
  async setOutputDevice(deviceId: string) {
    this.outputDeviceId = deviceId;
    
    for (const audio of this.audioElements.values()) {
      if ('setSinkId' in audio) {
        try {
          await (audio as any).setSinkId(deviceId);
        } catch (e) {
          console.warn('[AudioPlayback] Failed to set output device:', e);
        }
      }
    }
  }

  /**
   * Get available output devices
   */
  async getOutputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audiooutput');
    } catch (e) {
      console.warn('[AudioPlayback] Failed to enumerate devices:', e);
      return [];
    }
  }

  /**
   * Set callbacks
   */
  setCallbacks(
    onPlaybackStarted?: () => void,
    onPlaybackError?: (error: Error) => void
  ) {
    this.onPlaybackStarted = onPlaybackStarted || null;
    this.onPlaybackError = onPlaybackError || null;
  }

  /**
   * Get active peers count
   */
  getActivePeersCount(): number {
    return this.audioElements.size;
  }

  /**
   * Check if audio is playing for a peer
   */
  isPlayingForPeer(peerId: string): boolean {
    const audio = this.audioElements.get(peerId);
    return !!audio && !audio.paused;
  }

  /**
   * Cleanup all audio
   */
  cleanup() {
    console.log('[AudioPlayback] Cleaning up all audio...');

    this.audioElements.forEach((audio, peerId) => {
      console.log('[AudioPlayback] Removing audio for peer:', peerId);
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.audioElements.clear();
    this.pendingStreams.clear();

    // Clean up any orphaned elements
    document.querySelectorAll('[id^="space-audio-"]').forEach(el => {
      el.remove();
    });

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.masterGainNode = null;
    }

    console.log('[AudioPlayback] ✅ Cleanup complete');
  }
}

// Export singleton instance
export const audioPlaybackManager = new AudioPlaybackManager();

// Also export class for testing
export { AudioPlaybackManager };
