/**
 * Space Room Manager
 * 
 * Coordinates between Supabase (room state, speakers) and Cloudflare SFU (audio streaming).
 * Handles the high-level logic of managing a live audio space.
 */

import { supabase } from '@/integrations/supabase/client';
import { cloudflareSFU, type SFUSessionResult } from './cloudflare-sfu-client';

export interface SpaceSpeaker {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  cloudflare_session_id?: string;
  cloudflare_track_id?: string;
}

export interface SpaceRoomState {
  spaceId: string;
  sessionId: string | null;
  localTrackName: string | null;
  isHost: boolean;
  activeSpeakers: SpaceSpeaker[];
}

type StateChangeCallback = (state: SpaceRoomState) => void;
type AudioLevelCallback = (levels: Record<string, number>) => void;
type ConnectionStateCallback = (state: RTCPeerConnectionState) => void;

class SpaceRoomManager {
  private spaceId: string | null = null;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private localTrackName: string | null = null;
  private isHost: boolean = false;
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyzers: Map<string, AnalyserNode> = new Map();
  private audioLevelInterval: number | null = null;
  private onStateChange: StateChangeCallback | null = null;
  private onAudioLevels: AudioLevelCallback | null = null;
  private onConnectionStateChange: ConnectionStateCallback | null = null;
  private realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  private subscribedSpeakers: Set<string> = new Set();

  /**
   * Initialize the room manager for a specific space
   */
  async initialize(
    spaceId: string, 
    userId: string, 
    isHost: boolean,
    onStateChange?: StateChangeCallback,
    onAudioLevels?: AudioLevelCallback,
    onConnectionStateChange?: ConnectionStateCallback
  ): Promise<SFUSessionResult> {
    console.log('[SpaceRoomManager] Initializing for space:', spaceId, 'isHost:', isHost);
    
    this.spaceId = spaceId;
    this.userId = userId;
    this.isHost = isHost;
    this.onStateChange = onStateChange || null;
    this.onAudioLevels = onAudioLevels || null;
    this.onConnectionStateChange = onConnectionStateChange || null;
    this.subscribedSpeakers.clear();

    // Set up SFU callbacks before creating session
    cloudflareSFU.onTrack((track, peerId) => {
      console.log('[SpaceRoomManager] Received track from peer:', peerId);
      this.handleRemoteTrack(track, peerId);
    });

    cloudflareSFU.onStateChange((state) => {
      console.log('[SpaceRoomManager] SFU connection state:', state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    });

    // Create Cloudflare session
    const result = await cloudflareSFU.createSession();
    
    if (!result.success || !result.sessionId) {
      console.error('[SpaceRoomManager] Failed to create SFU session:', result.error);
      return result;
    }

    this.sessionId = result.sessionId;
    console.log('[SpaceRoomManager] SFU session created:', this.sessionId);

    // Store session ID in database for this space (host only)
    if (isHost) {
      await this.updateSpaceSession(result.sessionId);
    }

    // Subscribe to speaker changes for real-time updates
    this.setupRealtimeSubscription();

    this.notifyStateChange();
    return result;
  }

  /**
   * Update the space with the Cloudflare session ID
   */
  private async updateSpaceSession(sessionId: string) {
    if (!this.spaceId) return;

    const { error } = await supabase
      .from('live_spaces')
      .update({ cloudflare_session_id: sessionId })
      .eq('id', this.spaceId);

    if (error) {
      console.error('[SpaceRoomManager] Failed to update space session:', error);
    }
  }

  /**
   * Set up realtime subscription for speaker changes
   */
  private setupRealtimeSubscription() {
    if (!this.spaceId) return;

    this.realtimeChannel = supabase
      .channel(`space-sfu-${this.spaceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${this.spaceId}`,
      }, (payload) => {
        console.log('[SpaceRoomManager] Speaker change:', payload.eventType);
        this.handleSpeakerChange(payload);
      })
      .subscribe();
  }

  /**
   * Handle speaker changes from realtime updates
   */
  private async handleSpeakerChange(payload: any) {
    const { eventType, new: newData, old: oldData } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const speaker = newData as SpaceSpeaker;
      
      console.log('[SpaceRoomManager] Speaker change detected:', {
        event: eventType,
        speakerId: speaker.id,
        userId: speaker.user_id,
        hasSessionId: !!speaker.cloudflare_session_id,
        hasTrackId: !!speaker.cloudflare_track_id,
        isMe: speaker.user_id === this.userId,
        alreadySubscribed: this.subscribedSpeakers.has(speaker.user_id),
      });
      
      // If a speaker has track info, it's not me, and I haven't subscribed yet
      if (
        speaker.cloudflare_session_id && 
        speaker.cloudflare_track_id && 
        speaker.user_id !== this.userId &&
        !this.subscribedSpeakers.has(speaker.user_id)
      ) {
        console.log('[SpaceRoomManager] 🎧 New speaker to subscribe to:', speaker.user_id);
        await this.subscribeToSpeaker(speaker);
      }
    }

    this.notifyStateChange();
  }

  /**
   * Subscribe to a speaker's audio track
   */
  private async subscribeToSpeaker(speaker: SpaceSpeaker) {
    if (!this.sessionId || !speaker.cloudflare_session_id || !speaker.cloudflare_track_id) {
      console.warn('[SpaceRoomManager] Cannot subscribe - missing session or track info', {
        mySession: this.sessionId,
        speakerSession: speaker.cloudflare_session_id,
        speakerTrack: speaker.cloudflare_track_id,
      });
      return;
    }

    // Mark as subscribing to prevent duplicate subscriptions
    this.subscribedSpeakers.add(speaker.user_id);

    console.log('[SpaceRoomManager] 🎧 Subscribing to speaker:', speaker.user_id, {
      speakerSession: speaker.cloudflare_session_id.slice(0, 8),
      speakerTrack: speaker.cloudflare_track_id,
      mySession: this.sessionId.slice(0, 8),
    });

    const result = await cloudflareSFU.pullTracks(this.sessionId, [{
      location: 'remote',
      trackName: speaker.cloudflare_track_id,
      sessionId: speaker.cloudflare_session_id,
    }]);

    if (!result.success) {
      console.error('[SpaceRoomManager] ❌ Failed to subscribe to speaker:', result.error);
      this.subscribedSpeakers.delete(speaker.user_id); // Allow retry
    } else {
      console.log('[SpaceRoomManager] ✅ Successfully subscribed to speaker:', speaker.user_id);
    }
  }

  /**
   * Handle incoming remote audio track
   */
  private handleRemoteTrack(track: MediaStreamTrack, peerId: string) {
    console.log('[SpaceRoomManager] 🔊 Handling remote track from:', peerId);

    // Create analyzer for speaking indicator
    this.createAnalyzer(new MediaStream([track]), peerId);
  }

  /**
   * Start broadcasting audio (for hosts/speakers)
   */
  async startBroadcasting(stream: MediaStream): Promise<boolean> {
    if (!this.sessionId || !this.userId || !this.spaceId) {
      console.error('[SpaceRoomManager] Cannot broadcast - not initialized');
      return false;
    }

    console.log('[SpaceRoomManager] 🎤 Starting broadcast...');
    
    this.localStream = stream;
    this.localTrackName = `audio-${this.userId}-${Date.now()}`;

    // Create analyzer for local audio
    this.createAnalyzer(stream, this.userId);

    // Publish to SFU
    const result = await cloudflareSFU.publishAudioTrack(
      stream,
      this.sessionId,
      this.localTrackName
    );

    if (!result.success) {
      console.error('[SpaceRoomManager] ❌ Failed to start broadcasting:', result.error);
      return false;
    }

    console.log('[SpaceRoomManager] ✅ Broadcast started, updating database...');

    // Update speaker record with track info - this will trigger realtime update for listeners
    const { error } = await supabase
      .from('live_space_speakers')
      .update({
        cloudflare_session_id: this.sessionId,
        cloudflare_track_id: this.localTrackName,
      })
      .eq('space_id', this.spaceId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('[SpaceRoomManager] Failed to update speaker track info:', error);
    } else {
      console.log('[SpaceRoomManager] ✅ Speaker track info saved to database');
    }

    this.notifyStateChange();
    return true;
  }

  /**
   * Stop broadcasting audio
   */
  async stopBroadcasting(): Promise<void> {
    if (!this.sessionId || !this.localTrackName) return;

    console.log('[SpaceRoomManager] Stopping broadcast...');

    await cloudflareSFU.closeTrack(this.sessionId, this.localTrackName);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.localTrackName = null;
    this.notifyStateChange();
  }

  /**
   * Subscribe to all active speakers (for listeners joining)
   */
  async subscribeToAllSpeakers(): Promise<void> {
    if (!this.spaceId || !this.sessionId) return;

    console.log('[SpaceRoomManager] 🔍 Looking for active speakers to subscribe to...');

    // Retry logic to wait for host's track info to be saved
    const maxRetries = 8;
    const retryDelay = 1500;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Fetch all active speakers with track info
      const { data: speakers, error } = await supabase
        .from('live_space_speakers')
        .select('*')
        .eq('space_id', this.spaceId)
        .is('left_at', null)
        .not('cloudflare_track_id', 'is', null)
        .not('cloudflare_session_id', 'is', null);

      if (error) {
        console.error('[SpaceRoomManager] Failed to fetch speakers:', error);
        return;
      }

      const validSpeakers = (speakers || []).filter(
        s => s.user_id !== this.userId && !this.subscribedSpeakers.has(s.user_id)
      );
      
      console.log('[SpaceRoomManager] Found speakers with tracks:', validSpeakers.length, 'attempt:', attempt + 1);

      if (validSpeakers.length > 0) {
        // Subscribe to each speaker
        for (const speaker of validSpeakers) {
          console.log('[SpaceRoomManager] Subscribing to speaker:', speaker.user_id, 'track:', speaker.cloudflare_track_id);
          await this.subscribeToSpeaker(speaker as SpaceSpeaker);
        }
        return;
      }

      // No speakers found yet, wait and retry
      if (attempt < maxRetries - 1) {
        console.log('[SpaceRoomManager] ⏳ No speakers with tracks yet, waiting...', retryDelay, 'ms');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    console.log('[SpaceRoomManager] ⚠️ No speakers with tracks found after retries. Will subscribe when they publish via realtime.');
  }

  /**
   * Create audio analyzer for speaking indicators
   */
  private createAnalyzer(stream: MediaStream, peerId: string) {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyzer = this.audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);

      this.analyzers.set(peerId, analyzer);

      // Start monitoring if not already
      if (!this.audioLevelInterval) {
        this.startAudioLevelMonitoring();
      }
    } catch (error) {
      console.error('[SpaceRoomManager] Error creating analyzer:', error);
    }
  }

  /**
   * Start monitoring audio levels
   */
  private startAudioLevelMonitoring() {
    const updateLevels = () => {
      const levels: Record<string, number> = {};

      this.analyzers.forEach((analyzer, peerId) => {
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        levels[peerId] = Math.min(100, average * 1.5);
      });

      if (this.onAudioLevels) {
        this.onAudioLevels(levels);
      }
    };

    this.audioLevelInterval = window.setInterval(updateLevels, 100);
  }

  /**
   * Toggle local mute state
   */
  setMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Notify state change to callback
   */
  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        spaceId: this.spaceId || '',
        sessionId: this.sessionId,
        localTrackName: this.localTrackName,
        isHost: this.isHost,
        activeSpeakers: [],
      });
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    console.log('[SpaceRoomManager] Cleaning up...');

    // Stop audio level monitoring
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    // Stop broadcasting
    await this.stopBroadcasting();

    // Clear analyzers
    this.analyzers.clear();
    this.subscribedSpeakers.clear();

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Unsubscribe from realtime
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    // Cleanup SFU client
    cloudflareSFU.cleanup();

    // Reset state
    this.spaceId = null;
    this.userId = null;
    this.sessionId = null;
    this.isHost = false;
    this.onStateChange = null;
    this.onAudioLevels = null;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if currently broadcasting
   */
  isBroadcasting(): boolean {
    return this.localTrackName !== null;
  }
}

// Export singleton instance
export const spaceRoomManager = new SpaceRoomManager();

// Also export the class for testing
export { SpaceRoomManager };
