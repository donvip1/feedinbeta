// Call sound effects using Web Audio API
class CallSounds {
  private audioContext: AudioContext | null = null;
  private ringtonePlaying: boolean = false;
  private ringtoneInterval: NodeJS.Timeout | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private disconnectPlayed: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  private playTone(frequency: number, duration: number, volume: number = 0.3): OscillatorNode | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
      
      // Track active oscillators
      this.activeOscillators.push(oscillator);
      
      // Clean up after oscillator stops
      oscillator.onended = () => {
        const index = this.activeOscillators.indexOf(oscillator);
        if (index > -1) {
          this.activeOscillators.splice(index, 1);
        }
      };
      
      return oscillator;
    } catch (error) {
      console.error('Error playing tone:', error);
      return null;
    }
  }

  playRinging() {
    if (this.ringtonePlaying) return;
    this.ringtonePlaying = true;
    this.disconnectPlayed = false;

    const playRingPattern = () => {
      if (!this.ringtonePlaying) return;
      // Double ring pattern (like Tango/modern apps)
      this.playTone(480, 0.4, 0.4);
      setTimeout(() => {
        if (this.ringtonePlaying) {
          this.playTone(480, 0.4, 0.4);
        }
      }, 500);
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

  stopAllSounds() {
    this.stopRinging();
    
    // Stop all active oscillators
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Oscillator may already be stopped
      }
    });
    this.activeOscillators = [];
  }

  playConnected() {
    this.stopAllSounds();
    // Gentle connection tone
    this.playTone(660, 0.15, 0.2);
    setTimeout(() => this.playTone(880, 0.15, 0.2), 150);
  }

  playDisconnected() {
    // Only play once per call session
    if (this.disconnectPlayed) return;
    this.disconnectPlayed = true;
    
    this.stopRinging();
    // Descending disconnect tone - only once
    this.playTone(440, 0.2, 0.3);
    setTimeout(() => this.playTone(330, 0.3, 0.3), 200);
  }

  playBusy() {
    this.stopRinging();
    // Busy signal - play once
    this.playTone(480, 0.25, 0.4);
    setTimeout(() => this.playTone(620, 0.25, 0.4), 250);
  }

  // Reset for new call
  reset() {
    this.stopAllSounds();
    this.disconnectPlayed = false;
  }
}

export const callSounds = new CallSounds();
