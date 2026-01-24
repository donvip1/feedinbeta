// Chat Sound Effects System
// Provides audio feedback for messaging actions

export const CHAT_SOUNDS = {
  send: '/sounds/message-send.mp3',
  receive: '/sounds/message-receive.mp3',
  secret: '/sounds/secret-message.mp3',
  gift: '/sounds/notification.mp3',
  ring: '/sounds/notification.mp3',
  typing: '/sounds/notification.mp3',
} as const;

type SoundType = keyof typeof CHAT_SOUNDS;

class ChatSoundManager {
  private audioContext: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private lastPlayedAt: Map<SoundType, number> = new Map();
  private minInterval = 300; // Minimum ms between same sound plays

  constructor() {
    // Check user preference from localStorage
    const stored = localStorage.getItem('chat_sounds_enabled');
    this.soundEnabled = stored !== 'false';
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('AudioContext not supported');
        return null;
      }
    }
    
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    
    return this.audioContext;
  }

  /**
   * Play a chat sound effect
   * @param type - The type of sound to play
   * @param volume - Volume level (0-1), defaults to 0.4
   */
  play(type: SoundType, volume: number = 0.4): void {
    if (!this.soundEnabled) return;
    
    // Prevent rapid-fire of same sound
    const now = Date.now();
    const lastPlayed = this.lastPlayedAt.get(type) || 0;
    if (now - lastPlayed < this.minInterval) return;
    
    this.lastPlayedAt.set(type, now);
    
    try {
      const audio = new Audio(CHAT_SOUNDS[type]);
      audio.volume = Math.min(Math.max(volume, 0), 1);
      
      // Play and ignore errors (file might not exist yet)
      audio.play().catch(() => {
        // Fallback to Web Audio API beep
        this.playBeep(type);
      });
    } catch (e) {
      this.playBeep(type);
    }
  }

  /**
   * Fallback beep sound using Web Audio API
   */
  private playBeep(type: SoundType): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different frequencies for different sound types
      const frequencies: Record<SoundType, number> = {
        send: 880,
        receive: 660,
        secret: 440,
        gift: 1046,
        ring: 523,
        typing: 784,
      };

      oscillator.frequency.value = frequencies[type];
      oscillator.type = 'sine';

      const duration = type === 'gift' ? 0.3 : 0.1;
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Play message sent sound
   */
  playSend(): void {
    this.play('send', 0.3);
  }

  /**
   * Play message received sound
   */
  playReceive(): void {
    this.play('receive', 0.4);
  }

  /**
   * Play secret/self-destruct message sound
   */
  playSecret(): void {
    this.play('secret', 0.5);
  }

  /**
   * Play gift received sound
   */
  playGift(): void {
    this.play('gift', 0.5);
  }

  /**
   * Enable or disable sounds
   */
  setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('chat_sounds_enabled', String(enabled));
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Toggle sounds on/off
   */
  toggle(): boolean {
    this.setEnabled(!this.soundEnabled);
    return this.soundEnabled;
  }
}

// Singleton instance
export const chatSounds = new ChatSoundManager();

// Convenience exports
export const playSendSound = () => chatSounds.playSend();
export const playReceiveSound = () => chatSounds.playReceive();
export const playSecretSound = () => chatSounds.playSecret();
export const playGiftSound = () => chatSounds.playGift();
