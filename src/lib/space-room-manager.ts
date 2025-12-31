/**
 * Space Room Manager
 * 
 * Coordinates between Supabase (room state, speakers) and Cloudflare SFU (audio streaming).
 * Handles the high-level logic of managing a live audio space.
 * 
 * Each participant gets their own SFU session. They publish to their session,
 * and pull from other participants' sessions to hear them.
 */

import { supabase } from '@/integrations/supabase/client';
import { UnifiedSFUClient, createUnifiedSFUClient, type SFUSessionResult } from './unified-sfu-client';
import { audioPlaybackManager } from './audio-playback-manager';

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
  private sfuClient: UnifiedSFUClient | null = null;

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
    console.log('[SpaceRoomManager] ========================================');
    console.log('[SpaceRoomManager] Initializing for space:', spaceId);
    console.log('[SpaceRoomManager] User:', userId, 'isHost:', isHost);
    console.log('[SpaceRoomManager] ========================================');
    
    // Clean up any existing state first
    await this.cleanup();
    
    this.spaceId = spaceId;
    this.userId = userId;
    this.isHost = isHost;
    this.onStateChange = onStateChange || null;
    this.onAudioLevels = onAudioLevels || null;
    this.onConnectionStateChange = onConnectionStateChange || null;
    this.subscribedSpeakers.clear();

    // Create a NEW SFU client for this session
    this.sfuClient = createUnifiedSFUClient(`space-${spaceId}-${userId}`);

    // Set up SFU callbacks before creating session
    this.sfuClient.onTrack((track, peerId) => {
      console.log('[SpaceRoomManager] 🎧 Received track from peer:', peerId, {
        kind: track.kind,
        readyState: track.readyState,
        enabled: track.enabled,
      });
      this.handleRemoteTrack(track, peerId);
    });

    this.sfuClient.onStateChange((state) => {
      console.log('[SpaceRoomManager] SFU connection state:', state);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    });

    // Create Cloudflare session - each participant gets their own session
    const result = await this.sfuClient.createSession();
    
    if (!result.success || !result.sessionId) {
      console.error('[SpaceRoomManager] ❌ Failed to create SFU session:', result.error);
      return result;
    }

    this.sessionId = result.sessionId;
    console.log('[SpaceRoomManager] ✅ SFU session created:', this.sessionId.slice(0, 8));

    // Store session ID in database for this space (host only)
    if (isHost) {
      await this.updateSpaceSession(result.sessionId);
    }

    // Subscribe to speaker changes for real-time updates
    // This is CRITICAL for discovering new speakers who join/broadcast
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

    console.log('[SpaceRoomManager] Setting up realtime subscription for speaker changes...');
    
    this.realtimeChannel = supabase
      .channel(`space-sfu-${this.spaceId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_space_speakers',
        filter: `space_id=eq.${this.spaceId}`,
      }, (payload) => {
        console.log('[SpaceRoomManager] 📡 Speaker change event:', payload.eventType);
        this.handleSpeakerChange(payload);
      })
      .subscribe((status) => {
        console.log('[SpaceRoomManager] Realtime subscription status:', status);
      });
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
        speakerUserId: speaker.user_id,
        hasSessionId: !!speaker.cloudflare_session_id,
        hasTrackId: !!speaker.cloudflare_track_id,
        sessionId: speaker.cloudflare_session_id?.slice(0, 8),
        trackId: speaker.cloudflare_track_id?.slice(0, 30),
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
        console.log('[SpaceRoomManager] 🎧 New speaker detected, subscribing:', speaker.user_id);
        await this.subscribeToSpeaker(speaker);
      }
    }

    this.notifyStateChange();
  }

  /**
   * Subscribe to a speaker's audio track
   * This pulls the remote track from the speaker's Cloudflare SFU session to our local session
   */
  private async subscribeToSpeaker(speaker: SpaceSpeaker) {
    if (!this.sessionId || !this.sfuClient || !speaker.cloudflare_session_id || !speaker.cloudflare_track_id) {
      console.warn('[SpaceRoomManager] Cannot subscribe - missing session or track info', {
        mySession: this.sessionId?.slice(0, 8),
        speakerSession: speaker.cloudflare_session_id?.slice(0, 8),
        speakerTrack: speaker.cloudflare_track_id?.slice(0, 30),
      });
      return;
    }

    // Mark as subscribing to prevent duplicate subscriptions
    this.subscribedSpeakers.add(speaker.user_id);

    console.log('[SpaceRoomManager] ========================================');
    console.log('[SpaceRoomManager] 🎧 SUBSCRIBING TO SPEAKER');
    console.log('[SpaceRoomManager] Speaker user ID:', speaker.user_id);
    console.log('[SpaceRoomManager] Speaker session:', speaker.cloudflare_session_id.slice(0, 8));
    console.log('[SpaceRoomManager] Speaker track:', speaker.cloudflare_track_id);
    console.log('[SpaceRoomManager] My session:', this.sessionId.slice(0, 8));
    console.log('[SpaceRoomManager] ========================================');

    try {
      const result = await this.sfuClient.pullTracks([{
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
    } catch (error) {
      console.error('[SpaceRoomManager] ❌ Error subscribing to speaker:', error);
      this.subscribedSpeakers.delete(speaker.user_id); // Allow retry
    }
  }

  /**
   * Handle incoming remote audio track
   */
  private handleRemoteTrack(track: MediaStreamTrack, peerId: string) {
    console.log('[SpaceRoomManager] 🔊 Handling remote track from:', peerId, {
      kind: track.kind,
      readyState: track.readyState,
      enabled: track.enabled,
      muted: track.muted,
    });

    // Skip if track is not live
    if (track.readyState !== 'live') {
      console.warn('[SpaceRoomManager] Track is not live, skipping playback. State:', track.readyState);
      return;
    }

    // Create audio element for playback (SFU client already does this, but we also track for analyzer)
    this.playRemoteAudio(track, peerId);
    
    // Create analyzer for speaking indicator
    this.createAnalyzer(new MediaStream([track]), peerId);
  }

  /**
   * Play remote audio through an audio element (backup/additional handling)
   */
  private playRemoteAudio(track: MediaStreamTrack, peerId: string): void {
    // The SFU client already creates audio elements, this is for redundancy
    console.log('[SpaceRoomManager] 🔊 Remote audio setup complete for peer:', peerId);
  }

  /**
   * Start broadcasting audio (for hosts/speakers)
   */
  async startBroadcasting(stream: MediaStream): Promise<boolean> {
    if (!this.sessionId || !this.userId || !this.spaceId || !this.sfuClient) {
      console.error('[SpaceRoomManager] Cannot broadcast - not initialized', {
        sessionId: this.sessionId?.slice(0, 8),
        userId: this.userId,
        spaceId: this.spaceId?.slice(0, 8),
        hasSfuClient: !!this.sfuClient,
      });
      return false;
    }

    console.log('[SpaceRoomManager] ========================================');
    console.log('[SpaceRoomManager] 🎤 STARTING BROADCAST');
    console.log('[SpaceRoomManager] Session:', this.sessionId.slice(0, 8));
    console.log('[SpaceRoomManager] User:', this.userId);
    console.log('[SpaceRoomManager] Space:', this.spaceId.slice(0, 8));
    console.log('[SpaceRoomManager] ========================================');
    
    this.localStream = stream;
    this.localTrackName = `audio-${this.userId}-${Date.now()}`;

    // Create analyzer for local audio
    this.createAnalyzer(stream, this.userId);

    // Publish to SFU
    const result = await this.sfuClient.publishTrack(
      stream,
      this.localTrackName,
      'audio'
    );

    if (!result.success) {
      console.error('[SpaceRoomManager] ❌ Failed to publish to SFU:', result.error);
      return false;
    }

    console.log('[SpaceRoomManager] ✅ SFU track published, updating database...');

    // Update speaker record with track info - this will trigger realtime update for listeners
    // OPTIMIZED: Faster retries for instant updates
    let updateSuccess = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from('live_space_speakers')
        .update({
          cloudflare_session_id: this.sessionId,
          cloudflare_track_id: this.localTrackName,
        })
        .eq('space_id', this.spaceId)
        .eq('user_id', this.userId)
        .select();

      if (error) {
        console.error('[SpaceRoomManager] Attempt', attempt + 1, 'failed to update speaker track info:', error);
        await new Promise(r => setTimeout(r, 100)); // Fast retry - 100ms
        continue;
      }
      
      if (data && data.length > 0) {
        console.log('[SpaceRoomManager] ✅ Speaker track info saved INSTANTLY:', {
          sessionId: this.sessionId.slice(0, 8),
          trackId: this.localTrackName,
        });
        updateSuccess = true;
        break;
      } else {
        console.warn('[SpaceRoomManager] No speaker record found to update, attempt:', attempt + 1);
        await new Promise(r => setTimeout(r, 100)); // Fast retry
      }
    }

    if (!updateSuccess) {
      console.error('[SpaceRoomManager] ❌ Failed to save track info to database after retries');
    }

    this.notifyStateChange();
    return true;
  }

  /**
   * Stop broadcasting audio
   */
  async stopBroadcasting(): Promise<void> {
    if (!this.sessionId || !this.localTrackName || !this.sfuClient) return;

    console.log('[SpaceRoomManager] Stopping broadcast...');

    try {
      await this.sfuClient.closeTrack(this.localTrackName);
    } catch (e) {
      console.warn('[SpaceRoomManager] Error closing track (may be expected):', e);
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.localTrackName = null;
    this.notifyStateChange();
  }

  /**
   * Subscribe to all active speakers (for listeners joining)
   * This should be called after initialization for ALL participants (listeners AND speakers)
   * OPTIMIZED: No delays - instant subscription via realtime events
   */
  async subscribeToAllSpeakers(): Promise<void> {
    if (!this.spaceId || !this.sessionId) {
      console.warn('[SpaceRoomManager] Cannot subscribe - missing spaceId or sessionId');
      return;
    }

    console.log('[SpaceRoomManager] ========================================');
    console.log('[SpaceRoomManager] 🔍 SUBSCRIBING TO ALL SPEAKERS (INSTANT)');
    console.log('[SpaceRoomManager] Space:', this.spaceId.slice(0, 8));
    console.log('[SpaceRoomManager] My session:', this.sessionId.slice(0, 8));
    console.log('[SpaceRoomManager] My user ID:', this.userId);
    console.log('[SpaceRoomManager] ========================================');

    // Fetch all active speakers with track info - single attempt, no delays
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

    console.log('[SpaceRoomManager] Found speakers in DB:', speakers?.length || 0);

    // Filter out ourselves and already subscribed speakers
    const validSpeakers = (speakers || []).filter(
      s => s.user_id !== this.userId && !this.subscribedSpeakers.has(s.user_id)
    );
    
    console.log('[SpaceRoomManager] Speakers to subscribe to:', validSpeakers.length);

    if (validSpeakers.length > 0) {
      // Subscribe to each speaker in parallel for instant updates
      await Promise.all(validSpeakers.map(async (speaker) => {
        console.log('[SpaceRoomManager] 🎧 Subscribing to speaker:', speaker.user_id);
        await this.subscribeToSpeaker(speaker as SpaceSpeaker);
      }));
      console.log('[SpaceRoomManager] ✅ Subscribed to all found speakers');
    } else {
      console.log('[SpaceRoomManager] No speakers with tracks yet - will subscribe instantly via realtime when they publish');
    }
  }

  /**
   * Create audio analyzer for speaking indicators
   */
  private createAnalyzer(stream: MediaStream, peerId: string) {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
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
    console.log('[SpaceRoomManager] Cleaning up...', {
      spaceId: this.spaceId?.slice(0, 8),
      sessionId: this.sessionId?.slice(0, 8),
    });

    // Stop audio level monitoring
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    // Stop broadcasting
    await this.stopBroadcasting();

    // Use centralized audio manager for cleanup
    audioPlaybackManager.cleanup();

    // Clear analyzers
    this.analyzers.clear();
    this.subscribedSpeakers.clear();

    // Close audio context
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.warn('[SpaceRoomManager] Error closing audio context:', e);
      }
      this.audioContext = null;
    }

    // Unsubscribe from realtime
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    // Cleanup SFU client
    if (this.sfuClient) {
      this.sfuClient.cleanup();
      this.sfuClient = null;
    }

    // Reset state
    this.spaceId = null;
    this.userId = null;
    this.sessionId = null;
    this.localTrackName = null;
    this.isHost = false;
    this.onStateChange = null;
    this.onAudioLevels = null;
    this.onConnectionStateChange = null;
    
    console.log('[SpaceRoomManager] ✅ Cleanup complete');
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
