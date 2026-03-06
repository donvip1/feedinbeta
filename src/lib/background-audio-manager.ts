/**
 * Background Audio Manager
 * Maintains audio playback when app is minimized or in background
 * Uses Web Audio API with keep-alive mechanisms
 */

class BackgroundAudioManager {
  private audioContext: AudioContext | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private isActive: boolean = false;
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private mediaStreams: Map<string, MediaStreamAudioSourceNode> = new Map();
  private intentionallyMuted: Set<string> = new Set();
  private silentOscillator: OscillatorNode | null = null;

  async initialize(): Promise<void> {
    if (this.isActive) return;

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        
        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      }

      // Request wake lock to prevent device sleep during calls
      await this.requestWakeLock();

      // Start keep-alive mechanism
      this.startKeepAlive();

      // Listen for visibility changes
      document.addEventListener('visibilitychange', this.handleVisibilityChange);

      this.isActive = true;
      console.log('[BackgroundAudio] Initialized successfully');
    } catch (error) {
      console.error('[BackgroundAudio] Failed to initialize:', error);
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('[BackgroundAudio] Wake lock acquired');
        
        this.wakeLock.addEventListener('release', () => {
          console.log('[BackgroundAudio] Wake lock released');
        });
      }
    } catch (error) {
      console.warn('[BackgroundAudio] Wake lock not available:', error);
    }
  }

  private startKeepAlive(): void {
    // Keep audio context alive with periodic activity - more frequent for background reliability
    this.keepAliveInterval = setInterval(() => {
      this.pingAudioContext();
    }, 3000); // Every 3 seconds for better background persistence
  }

  private pingAudioContext(): void {
    if (!this.audioContext) return;

    try {
      // Resume if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Play a silent buffer to keep the context alive
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      // Use very low gain so it's inaudible
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.001;
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      // Silent fail - this is a background ping
    }
  }

  private handleVisibilityChange = async (): Promise<void> => {
    if (document.hidden) {
      console.log('[BackgroundAudio] App went to background');
      // Ensure audio keeps playing in background
      this.ensureAudioContinues();
    } else {
      console.log('[BackgroundAudio] App returned to foreground');
      // Re-acquire wake lock when returning to foreground
      await this.requestWakeLock();
      
      // Resume audio context if needed
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }
    }
  };

  private ensureAudioContinues(): void {
    // Resume audio context
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    // Ensure all tracked audio elements are playing
    this.audioElements.forEach((element, id) => {
      if (element.paused && element.srcObject) {
        element.play().catch(err => {
          console.warn(`[BackgroundAudio] Failed to resume audio ${id}:`, err);
        });
      }
    });

    // Re-enable any muted media stream tracks that should be active
    this.mediaStreams.forEach((source, id) => {
      try {
        const stream = source.mediaStream;
        if (stream) {
          stream.getAudioTracks().forEach(track => {
            if (!track.enabled && !this.intentionallyMuted.has(id)) {
              track.enabled = true;
              console.log(`[BackgroundAudio] Re-enabled audio track for ${id}`);
            }
          });
        }
      } catch (err) {
        // Silent fail
      }
    });

    // Start silent oscillator if not running
    this.startSilentOscillator();
  }

  private startSilentOscillator(): void {
    if (this.silentOscillator || !this.audioContext) return;

    try {
      this.silentOscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Completely silent
      gainNode.gain.value = 0;
      
      this.silentOscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      this.silentOscillator.start();
      
      console.log('[BackgroundAudio] Started silent oscillator');
    } catch (error) {
      console.warn('[BackgroundAudio] Failed to start oscillator:', error);
    }
  }

  private stopSilentOscillator(): void {
    if (this.silentOscillator) {
      try {
        this.silentOscillator.stop();
        this.silentOscillator.disconnect();
      } catch (error) {
        // Already stopped
      }
      this.silentOscillator = null;
    }
  }

  /**
   * Register an audio element for background playback management
   */
  registerAudioElement(id: string, element: HTMLAudioElement): void {
    this.audioElements.set(id, element);
    
    // Configure for background playback
    element.setAttribute('playsinline', 'true');
    (element as any).playsInline = true;
    
    console.log(`[BackgroundAudio] Registered audio element: ${id}`);
  }

  /**
   * Unregister an audio element
   */
  unregisterAudioElement(id: string): void {
    this.audioElements.delete(id);
    console.log(`[BackgroundAudio] Unregistered audio element: ${id}`);
  }

  /**
   * Connect a MediaStream to the audio context for background playback
   */
  connectMediaStream(stream: MediaStream, id?: string): MediaStreamAudioSourceNode | null {
    if (!this.audioContext) return null;

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.audioContext.destination);
      const streamId = id || `stream-${Date.now()}`;
      this.mediaStreams.set(streamId, source);
      console.log(`[BackgroundAudio] Connected MediaStream: ${streamId}`);
      return source;
    } catch (error) {
      console.error('[BackgroundAudio] Failed to connect MediaStream:', error);
      return null;
    }
  }

  /**
   * Mark a stream as intentionally muted (user chose to mute)
   */
  setStreamMuted(id: string, muted: boolean): void {
    if (muted) {
      this.intentionallyMuted.add(id);
    } else {
      this.intentionallyMuted.delete(id);
    }
  }

  /**
   * Disconnect a media stream
   */
  disconnectMediaStream(id: string): void {
    const source = this.mediaStreams.get(id);
    if (source) {
      try { source.disconnect(); } catch {}
      this.mediaStreams.delete(id);
      this.intentionallyMuted.delete(id);
      console.log(`[BackgroundAudio] Disconnected MediaStream: ${id}`);
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    this.isActive = false;

    // Remove event listener
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    // Clear keep-alive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // Stop silent oscillator
    this.stopSilentOscillator();

    // Release wake lock
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (error) {
        // Already released
      }
      this.wakeLock = null;
    }

    // Close audio context
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        // Already closed
      }
      this.audioContext = null;
    }

    // Clear audio elements
    this.audioElements.clear();

    console.log('[BackgroundAudio] Cleaned up');
  }

  /**
   * Check if background audio is active
   */
  isBackgroundAudioActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the audio context for external use
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
}

// Export singleton instance
export const backgroundAudioManager = new BackgroundAudioManager();
