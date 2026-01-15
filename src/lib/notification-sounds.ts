// Notification Sound Manager
// Centralized manager for playing different notification sounds

type NotificationType = 
  | 'gift' 
  | 'credit' 
  | 'message' 
  | 'like' 
  | 'comment' 
  | 'friend_request' 
  | 'call' 
  | 'default'
  | 'success';

interface SoundConfig {
  src: string;
  volume: number;
}

const SOUND_CONFIGS: Record<NotificationType, SoundConfig> = {
  gift: { src: '/sounds/gift-notification.mp3', volume: 0.7 },
  credit: { src: '/sounds/credit-notification.mp3', volume: 0.6 },
  message: { src: '/sounds/message-notification.mp3', volume: 0.5 },
  like: { src: '/sounds/like-notification.mp3', volume: 0.4 },
  comment: { src: '/sounds/comment-notification.mp3', volume: 0.5 },
  friend_request: { src: '/sounds/friend-notification.mp3', volume: 0.6 },
  call: { src: '/sounds/ringtone.mp3', volume: 0.8 },
  default: { src: '/sounds/notification.mp3', volume: 0.5 },
  success: { src: '/sounds/success.mp3', volume: 0.5 },
};

// Map notification types from database to sound categories
const TYPE_TO_SOUND_MAP: Record<string, NotificationType> = {
  // Gift types
  'gift': 'gift',
  'gift_received': 'gift',
  'live_gift': 'gift',
  'space_gift': 'gift',
  
  // Credit types
  'credit_received': 'credit',
  'credit_transfer': 'credit',
  'credits_added': 'credit',
  
  // Message types
  'message': 'message',
  'chat_message': 'message',
  
  // Social types
  'like': 'like',
  'post_like': 'like',
  'refeed': 'like',
  'quote': 'like',
  
  // Comment types
  'comment': 'comment',
  'reply': 'comment',
  'mention': 'comment',
  
  // Friend types
  'friend_request': 'friend_request',
  'friend_request_accepted': 'friend_request',
  'follow': 'friend_request',
  
  // Call types
  'incoming_call': 'call',
  
  // Live types
  'live_invite': 'default',
  'space_invite': 'default',
};

class NotificationSoundManager {
  private sounds: Map<NotificationType, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private isPreloaded = false;
  private isMuted = false;
  
  constructor() {
    // Initialize when first used
    if (typeof window !== 'undefined') {
      this.initializeAudioContext();
    }
  }
  
  private initializeAudioContext() {
    try {
      // Use AudioContext for better control
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.log('[NotificationSounds] AudioContext not available');
    }
  }
  
  /**
   * Preload all notification sounds for instant playback
   */
  async preload(): Promise<void> {
    if (this.isPreloaded) return;
    
    const loadPromises = Object.entries(SOUND_CONFIGS).map(async ([type, config]) => {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = config.volume;
        audio.src = config.src;
        
        // Try to load the audio
        await new Promise((resolve, reject) => {
          audio.oncanplaythrough = resolve;
          audio.onerror = () => {
            console.log(`[NotificationSounds] Could not load ${type} sound, will use fallback`);
            resolve(null); // Don't reject, just log
          };
          // Timeout after 5 seconds
          setTimeout(resolve, 5000);
        });
        
        this.sounds.set(type as NotificationType, audio);
      } catch (error) {
        console.log(`[NotificationSounds] Failed to preload ${type}:`, error);
      }
    });
    
    await Promise.all(loadPromises);
    this.isPreloaded = true;
    console.log('[NotificationSounds] Preloaded', this.sounds.size, 'sounds');
  }
  
  /**
   * Get the sound type for a notification type from the database
   */
  getSoundTypeForNotification(notificationType: string): NotificationType {
    return TYPE_TO_SOUND_MAP[notificationType] || 'default';
  }
  
  /**
   * Play a notification sound
   */
  async play(type: NotificationType | string): Promise<void> {
    if (this.isMuted) return;
    
    // Convert notification type to sound type if needed
    const soundType = TYPE_TO_SOUND_MAP[type] || (type as NotificationType) || 'default';
    const config = SOUND_CONFIGS[soundType] || SOUND_CONFIGS.default;
    
    try {
      // Resume audio context if suspended (required for mobile)
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Try to use preloaded sound
      let audio = this.sounds.get(soundType);
      
      if (audio) {
        // Clone the audio for overlapping sounds
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = config.volume;
        await clone.play().catch(() => {
          console.log('[NotificationSounds] Playback blocked, user interaction required');
        });
      } else {
        // Fallback: create new audio element
        audio = new Audio(config.src);
        audio.volume = config.volume;
        await audio.play().catch(() => {
          console.log('[NotificationSounds] Fallback playback blocked');
        });
      }
    } catch (error) {
      console.log('[NotificationSounds] Error playing sound:', error);
    }
  }
  
  /**
   * Play a sound for a specific notification from the database
   */
  async playForNotification(notificationType: string): Promise<void> {
    const soundType = this.getSoundTypeForNotification(notificationType);
    await this.play(soundType);
  }
  
  /**
   * Mute all notification sounds
   */
  mute(): void {
    this.isMuted = true;
  }
  
  /**
   * Unmute notification sounds
   */
  unmute(): void {
    this.isMuted = false;
  }
  
  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
  
  /**
   * Check if sounds are muted
   */
  get muted(): boolean {
    return this.isMuted;
  }
  
  /**
   * Set volume for a specific sound type
   */
  setVolume(type: NotificationType, volume: number): void {
    const audio = this.sounds.get(type);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

// Singleton instance
export const notificationSounds = new NotificationSoundManager();

// Auto-preload on user interaction (required for mobile)
if (typeof window !== 'undefined') {
  const preloadOnInteraction = () => {
    notificationSounds.preload();
    document.removeEventListener('click', preloadOnInteraction);
    document.removeEventListener('touchstart', preloadOnInteraction);
    document.removeEventListener('keydown', preloadOnInteraction);
  };
  
  document.addEventListener('click', preloadOnInteraction, { once: true });
  document.addEventListener('touchstart', preloadOnInteraction, { once: true });
  document.addEventListener('keydown', preloadOnInteraction, { once: true });
}
