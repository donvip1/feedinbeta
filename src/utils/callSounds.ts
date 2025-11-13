// Call sound effects using Web Audio API
class CallSounds {
  private audioContext: AudioContext | null = null;
  private ringtonePlaying: boolean = false;
  private ringtoneInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playRinging() {
    if (this.ringtonePlaying) return;
    this.ringtonePlaying = true;

    const playRingPattern = () => {
      // Double ring pattern (like Tango/modern apps)
      this.playTone(480, 0.4, 0.4);
      setTimeout(() => this.playTone(480, 0.4, 0.4), 500);
    };

    playRingPattern();
    this.ringtoneInterval = setInterval(playRingPattern, 3000);
  }

  stopRinging() {
    this.ringtonePlaying = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  playConnected() {
    // Gentle connection tone
    this.playTone(660, 0.15, 0.2);
    setTimeout(() => this.playTone(880, 0.15, 0.2), 150);
  }

  playDisconnected() {
    // Descending disconnect tone
    this.playTone(440, 0.2, 0.3);
    setTimeout(() => this.playTone(330, 0.3, 0.3), 200);
  }

  playBusy() {
    // Busy signal
    this.playTone(480, 0.25, 0.4);
    setTimeout(() => this.playTone(620, 0.25, 0.4), 250);
  }
}

export const callSounds = new CallSounds();
