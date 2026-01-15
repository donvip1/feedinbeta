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
  private screenTrackName: string | null = null;
  private isHost: boolean = false;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyzers: Map<string, AnalyserNode> = new Map();
  private audioLevelInterval: number | null = null;
  private onStateChange: StateChangeCallback | null = null;
  private onAudioLevels: AudioLevelCallback | null = null;
  private onConnectionStateChange: ConnectionStateCallback | null = null;
  private onScreenShareChange: ((isSharing: boolean, stream: MediaStream | null) => void) | null = null;
  private realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  private subscribedSpeakers: Set<string> = new Set();
  private subscribedScreenShares: Set<string> = new Set();
  private failedSubscriptions: Set<string> = new Set(); // Track failed subscriptions for retry
  private sfuClient: UnifiedSFUClient | null = null;
  private periodicRefreshInterval: number | null = null;

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

    // Start periodic refresh for speaker subscriptions (fallback for missed realtime events)
    this.startPeriodicSpeakerRefresh();

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
   * CRITICAL: This is the main mechanism for discovering new broadcasters
   */
  private async handleSpeakerChange(payload: any) {
    const { eventType, new: newData, old: oldData } = payload;

    console.log('[SpaceRoomManager] ========================================');
    console.log('[SpaceRoomManager] 📡 SPEAKER CHANGE EVENT');
    console.log('[SpaceRoomManager] Event type:', eventType);
    console.log('[SpaceRoomManager] User ID:', newData?.user_id);
    console.log('[SpaceRoomManager] OLD track_id:', oldData?.cloudflare_track_id?.slice(0, 30) || 'null');
    console.log('[SpaceRoomManager] NEW track_id:', newData?.cloudflare_track_id?.slice(0, 30) || 'null');
    console.log('[SpaceRoomManager] OLD session_id:', oldData?.cloudflare_session_id?.slice(0, 8) || 'null');
    console.log('[SpaceRoomManager] NEW session_id:', newData?.cloudflare_session_id?.slice(0, 8) || 'null');
    console.log('[SpaceRoomManager] Is me:', newData?.user_id === this.userId);
    console.log('[SpaceRoomManager] Already subscribed:', this.subscribedSpeakers.has(newData?.user_id));
    console.log('[SpaceRoomManager] Previously failed:', this.failedSubscriptions.has(newData?.user_id));
    console.log('[SpaceRoomManager] Currently subscribed to:', Array.from(this.subscribedSpeakers));
    console.log('[SpaceRoomManager] ========================================');

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const speaker = newData as SpaceSpeaker;
      
      // Skip if it's me
      if (speaker.user_id === this.userId) {
        console.log('[SpaceRoomManager] Skipping - this is my own update');
        return;
      }
      
      // Check if this speaker has track info (meaning they're broadcasting)
      const hasTrackInfo = speaker.cloudflare_session_id && speaker.cloudflare_track_id;
      
      if (!hasTrackInfo) {
        console.log('[SpaceRoomManager] Speaker has no track info yet, waiting for them to broadcast');
        return;
      }
      
      // CRITICAL: Check if track was JUST added (null -> value)
      // This is the key moment when a user starts broadcasting
      const trackJustAdded = eventType === 'UPDATE' && 
        !oldData?.cloudflare_track_id && 
        speaker.cloudflare_track_id;
        
      // Also check if track CHANGED (user republished with new track)
      const trackChanged = eventType === 'UPDATE' && 
        oldData?.cloudflare_track_id && 
        speaker.cloudflare_track_id &&
        oldData.cloudflare_track_id !== speaker.cloudflare_track_id;
      
      // Subscribe if: 
      // 1. Never subscribed (new speaker with INSERT)
      // 2. Track just added (user just started broadcasting)
      // 3. Track changed (user republished)
      // 4. Previously failed (retry)
      const neverSubscribed = !this.subscribedSpeakers.has(speaker.user_id);
      const previouslyFailed = this.failedSubscriptions.has(speaker.user_id);
      
      const shouldSubscribe = neverSubscribed || trackJustAdded || trackChanged || previouslyFailed;
      
      console.log('[SpaceRoomManager] Subscription decision:', {
        neverSubscribed,
        trackJustAdded,
        trackChanged,
        previouslyFailed,
        shouldSubscribe,
      });
        
      if (shouldSubscribe) {
        console.log('[SpaceRoomManager] 🎧🎧🎧 SUBSCRIBING TO NEW SPEAKER:', speaker.user_id);
        // Clear tracking to allow fresh subscription
        this.failedSubscriptions.delete(speaker.user_id);
        this.subscribedSpeakers.delete(speaker.user_id);
        
        // Subscribe with slight delay to ensure track is fully registered on SFU
        setTimeout(async () => {
          await this.subscribeToSpeaker(speaker);
        }, 500);
      } else {
        console.log('[SpaceRoomManager] Already subscribed to this speaker, no action needed');
      }
    } else if (eventType === 'DELETE') {
      // User left, remove from subscribed set
      if (oldData?.user_id) {
        console.log('[SpaceRoomManager] Speaker left, removing from subscribed set:', oldData.user_id);
        this.subscribedSpeakers.delete(oldData.user_id);
        this.failedSubscriptions.delete(oldData.user_id);
        
        // Remove their audio element
        const audioEl = document.getElementById(`space-audio-backup-${oldData.user_id}`);
        if (audioEl) audioEl.remove();
      }
    }

    this.notifyStateChange();
  }

  /**
   * Subscribe to a speaker's audio track with retry logic
   * This pulls the remote track from the speaker's Cloudflare SFU session to our local session
   */
  private async subscribeToSpeaker(speaker: SpaceSpeaker, retryCount = 0): Promise<boolean> {
    const maxRetries = 3;
    
    if (!this.sessionId || !this.sfuClient || !speaker.cloudflare_session_id || !speaker.cloudflare_track_id) {
      console.warn('[SpaceRoomManager] Cannot subscribe - missing session or track info', {
        mySession: this.sessionId?.slice(0, 8),
        speakerSession: speaker.cloudflare_session_id?.slice(0, 8),
        speakerTrack: speaker.cloudflare_track_id?.slice(0, 30),
      });
      return false;
    }

    // Mark as subscribing to prevent duplicate subscriptions
    this.subscribedSpeakers.add(speaker.user_id);

    console.log('[SpaceRoomManager] ========================================');
    console.log(`[SpaceRoomManager] 🎧 SUBSCRIBING TO SPEAKER (attempt ${retryCount + 1}/${maxRetries + 1})`);
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
        
        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
          console.log(`[SpaceRoomManager] Retrying subscription in ${delay}ms...`);
          this.subscribedSpeakers.delete(speaker.user_id); // Allow retry
          await new Promise(r => setTimeout(r, delay));
          return this.subscribeToSpeaker(speaker, retryCount + 1);
        } else {
          // Mark as failed for potential refresh retry later
          this.failedSubscriptions.add(speaker.user_id);
          this.subscribedSpeakers.delete(speaker.user_id);
          return false;
        }
      } else {
        console.log('[SpaceRoomManager] ✅ Successfully subscribed to speaker:', speaker.user_id);
        this.failedSubscriptions.delete(speaker.user_id);
        return true;
      }
    } catch (error) {
      console.error('[SpaceRoomManager] ❌ Error subscribing to speaker:', error);
      
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 500;
        console.log(`[SpaceRoomManager] Retrying subscription in ${delay}ms...`);
        this.subscribedSpeakers.delete(speaker.user_id);
        await new Promise(r => setTimeout(r, delay));
        return this.subscribeToSpeaker(speaker, retryCount + 1);
      } else {
        this.failedSubscriptions.add(speaker.user_id);
        this.subscribedSpeakers.delete(speaker.user_id);
        return false;
      }
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

    // Create audio element for playback with extra reliability
    this.playRemoteAudio(track, peerId);
    
    // Create analyzer for speaking indicator - CRITICAL for visual feedback
    const stream = new MediaStream([track]);
    this.createAnalyzer(stream, peerId);
    
    // Log audio level detection status
    console.log('[SpaceRoomManager] ✅ Analyzer created for peer:', peerId, 'Total analyzers:', this.analyzers.size);
  }

  /**
   * Play remote audio through an audio element (backup/additional handling)
   */
  private playRemoteAudio(track: MediaStreamTrack, peerId: string): void {
    // Create an additional backup audio element for this track
    // This ensures playback even if the primary handler fails
    try {
      const existingEl = document.getElementById(`space-audio-backup-${peerId}`);
      if (existingEl) {
        existingEl.remove();
      }
      
      const audio = document.createElement('audio');
      audio.id = `space-audio-backup-${peerId}`;
      audio.autoplay = true;
      (audio as any).playsInline = true; // For iOS support
      audio.srcObject = new MediaStream([track]);
      audio.style.display = 'none';
      document.body.appendChild(audio);
      
      // Ensure playback starts
      audio.play().then(() => {
        console.log('[SpaceRoomManager] 🔊 Backup audio element playing for peer:', peerId);
      }).catch(e => {
        console.warn('[SpaceRoomManager] Backup audio play failed (may need user interaction):', e);
      });
    } catch (e) {
      console.warn('[SpaceRoomManager] Could not create backup audio element:', e);
    }
  }
  
  /**
   * Start periodic refresh for speaker subscriptions
   * This is a fallback mechanism to ensure we don't miss any speakers
   * CRITICAL: This runs every 5 seconds to catch any missed realtime events
   */
  private startPeriodicSpeakerRefresh(): void {
    // Clear any existing interval
    if (this.periodicRefreshInterval) {
      clearInterval(this.periodicRefreshInterval);
    }
    
    console.log('[SpaceRoomManager] 🔄 Starting periodic speaker refresh (every 5 seconds)');
    
    this.periodicRefreshInterval = window.setInterval(async () => {
      if (!this.spaceId || !this.sessionId) {
        return;
      }
      
      // Check for any speakers with track info that we haven't subscribed to
      const { data: speakers, error } = await supabase
        .from('live_space_speakers')
        .select('*')
        .eq('space_id', this.spaceId)
        .is('left_at', null)
        .not('cloudflare_track_id', 'is', null)
        .not('cloudflare_session_id', 'is', null);
        
      if (error) {
        console.warn('[SpaceRoomManager] Error fetching speakers during refresh:', error);
        return;
      }
      
      // Log current state for debugging
      console.log('[SpaceRoomManager] 🔄 Periodic refresh:', {
        speakersInDB: speakers?.map(s => ({
          userId: s.user_id.slice(0, 8),
          hasTrack: !!s.cloudflare_track_id,
        })),
        currentlySubscribed: Array.from(this.subscribedSpeakers).map(id => id.slice(0, 8)),
        failedSubscriptions: Array.from(this.failedSubscriptions).map(id => id.slice(0, 8)),
      });
      
      const unsubscribedSpeakers = (speakers || []).filter(
        s => s.user_id !== this.userId && 
             (!this.subscribedSpeakers.has(s.user_id) || this.failedSubscriptions.has(s.user_id))
      );
      
      if (unsubscribedSpeakers.length > 0) {
        console.log(`[SpaceRoomManager] 🔄🔄🔄 FOUND ${unsubscribedSpeakers.length} UNSUBSCRIBED SPEAKERS!`);
        
        for (const speaker of unsubscribedSpeakers) {
          console.log('[SpaceRoomManager] 🔄 Subscribing to missed speaker:', speaker.user_id.slice(0, 8));
          this.failedSubscriptions.delete(speaker.user_id);
          this.subscribedSpeakers.delete(speaker.user_id);
          await this.subscribeToSpeaker(speaker as SpaceSpeaker);
        }
      }
    }, 5000); // Every 5 seconds for faster detection
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
   * OPTIMIZED: Retry mechanism for when host hasn't published yet
   */
  async subscribeToAllSpeakers(): Promise<void> {
    if (!this.spaceId || !this.sessionId) {
      console.warn('[SpaceRoomManager] Cannot subscribe - missing spaceId or sessionId');
      return;
    }

    console.log('[SpaceRoomManager] ========================================');
    console.log('[SpaceRoomManager] 🔍 SUBSCRIBING TO ALL SPEAKERS');
    console.log('[SpaceRoomManager] Space:', this.spaceId.slice(0, 8));
    console.log('[SpaceRoomManager] My session:', this.sessionId.slice(0, 8));
    console.log('[SpaceRoomManager] My user ID:', this.userId);
    console.log('[SpaceRoomManager] ========================================');

    // Try multiple times with short delays - host may not have published yet
    const maxAttempts = 5;
    const retryDelayMs = 1500;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        continue;
      }

      console.log(`[SpaceRoomManager] Attempt ${attempt}/${maxAttempts} - Found speakers with tracks:`, speakers?.length || 0);

      // Filter out ourselves and already subscribed speakers
      const validSpeakers = (speakers || []).filter(
        s => s.user_id !== this.userId && !this.subscribedSpeakers.has(s.user_id)
      );
      
      console.log('[SpaceRoomManager] Speakers to subscribe to:', validSpeakers.length);

      if (validSpeakers.length > 0) {
        // Subscribe to each speaker in parallel
        await Promise.all(validSpeakers.map(async (speaker) => {
          console.log('[SpaceRoomManager] 🎧 Subscribing to speaker:', speaker.user_id);
          await this.subscribeToSpeaker(speaker as SpaceSpeaker);
        }));
        console.log('[SpaceRoomManager] ✅ Subscribed to all found speakers');
        return; // Success, exit
      }
      
      // No speakers found yet, wait and retry
      if (attempt < maxAttempts) {
        console.log(`[SpaceRoomManager] No speakers with tracks yet, retrying in ${retryDelayMs}ms...`);
        await new Promise(r => setTimeout(r, retryDelayMs));
      }
    }
    
    console.log('[SpaceRoomManager] No speakers with tracks after retries - will subscribe via realtime when they publish');
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

    // Stop periodic refresh
    if (this.periodicRefreshInterval) {
      clearInterval(this.periodicRefreshInterval);
      this.periodicRefreshInterval = null;
    }

    // Stop audio level monitoring
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    // Stop screen sharing
    await this.stopScreenShare();

    // Stop broadcasting
    await this.stopBroadcasting();

    // Use centralized audio manager for cleanup
    audioPlaybackManager.cleanup();
    
    // Remove backup audio elements and video elements
    document.querySelectorAll('[id^="space-audio-backup-"]').forEach(el => el.remove());
    document.querySelectorAll('[id^="sfu-video-"]').forEach(el => el.remove());

    // Clear analyzers
    this.analyzers.clear();
    this.subscribedSpeakers.clear();
    this.subscribedScreenShares.clear();
    this.failedSubscriptions.clear();

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
    this.screenTrackName = null;
    this.isHost = false;
    this.onStateChange = null;
    this.onAudioLevels = null;
    this.onConnectionStateChange = null;
    this.onScreenShareChange = null;
    
    console.log('[SpaceRoomManager] ✅ Cleanup complete');
  }
  
  /**
   * Force resubscribe to all speakers (for manual retry)
   */
  async forceResubscribeAll(): Promise<void> {
    console.log('[SpaceRoomManager] 🔄 Force resubscribing to all speakers...');
    
    // Clear all subscription state
    this.subscribedSpeakers.clear();
    this.failedSubscriptions.clear();
    
    // Resubscribe
    await this.subscribeToAllSpeakers();
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

  /**
   * Check if currently screen sharing
   */
  isScreenSharing(): boolean {
    return this.screenTrackName !== null;
  }

  /**
   * Set screen share change callback
   */
  setOnScreenShareChange(callback: ((isSharing: boolean, stream: MediaStream | null) => void) | null): void {
    this.onScreenShareChange = callback;
  }

  /**
   * Start screen sharing and broadcast to all participants
   */
  async startScreenShare(): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
    if (!this.sessionId || !this.userId || !this.spaceId || !this.sfuClient) {
      return { success: false, error: 'Not initialized' };
    }

    if (this.screenTrackName) {
      return { success: false, error: 'Already sharing screen' };
    }

    try {
      console.log('[SpaceRoomManager] 🖥️ Starting screen share...');
      
      // Get screen stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      this.screenStream = stream;
      this.screenTrackName = `screen-${this.userId}-${Date.now()}`;

      // Handle user stopping via browser UI
      stream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      // Publish video track to SFU
      const result = await this.sfuClient.publishTrack(
        stream,
        this.screenTrackName,
        'video'
      );

      if (!result.success) {
        this.screenStream?.getTracks().forEach(t => t.stop());
        this.screenStream = null;
        this.screenTrackName = null;
        return { success: false, error: result.error };
      }

      console.log('[SpaceRoomManager] ✅ Screen share published to SFU');

      // Update speaker record with screen share track info
      await supabase
        .from('live_space_speakers')
        .update({
          // We can use a JSON field or add new columns for screen share
          // For now, broadcast via realtime channel
        })
        .eq('space_id', this.spaceId)
        .eq('user_id', this.userId);

      // Broadcast screen share status to all participants
      const channel = supabase.channel(`space-screen-${this.spaceId}`);
      await channel.send({
        type: 'broadcast',
        event: 'screen-share-started',
        payload: {
          userId: this.userId,
          sessionId: this.sessionId,
          trackName: this.screenTrackName,
        },
      });
      supabase.removeChannel(channel);

      // Notify callback
      if (this.onScreenShareChange) {
        this.onScreenShareChange(true, stream);
      }

      this.notifyStateChange();
      return { success: true, stream };
    } catch (error: any) {
      console.error('[SpaceRoomManager] Screen share error:', error);
      return { 
        success: false, 
        error: error.name === 'NotAllowedError' ? 'Permission denied' : error.message 
      };
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.screenTrackName || !this.sfuClient) return;

    console.log('[SpaceRoomManager] 🖥️ Stopping screen share...');

    try {
      await this.sfuClient.closeTrack(this.screenTrackName);
    } catch (e) {
      console.warn('[SpaceRoomManager] Error closing screen track:', e);
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Broadcast screen share ended
    if (this.spaceId) {
      const channel = supabase.channel(`space-screen-${this.spaceId}`);
      await channel.send({
        type: 'broadcast',
        event: 'screen-share-ended',
        payload: { userId: this.userId },
      });
      supabase.removeChannel(channel);
    }

    this.screenTrackName = null;

    // Notify callback
    if (this.onScreenShareChange) {
      this.onScreenShareChange(false, null);
    }

    this.notifyStateChange();
  }

  /**
   * Subscribe to a remote screen share
   */
  async subscribeToScreenShare(
    userId: string, 
    sessionId: string, 
    trackName: string
  ): Promise<{ success: boolean; stream?: MediaStream }> {
    if (!this.sfuClient || !this.sessionId) {
      return { success: false };
    }

    if (userId === this.userId) {
      // Don't subscribe to our own screen share
      return { success: false };
    }

    if (this.subscribedScreenShares.has(userId)) {
      return { success: false };
    }

    console.log('[SpaceRoomManager] 🖥️ Subscribing to screen share from:', userId);
    this.subscribedScreenShares.add(userId);

    try {
      const result = await this.sfuClient.pullTracks([{
        location: 'remote',
        trackName,
        sessionId,
      }]);

      if (!result.success) {
        this.subscribedScreenShares.delete(userId);
        return { success: false };
      }

      console.log('[SpaceRoomManager] ✅ Subscribed to screen share');
      return { success: true };
    } catch (error) {
      this.subscribedScreenShares.delete(userId);
      return { success: false };
    }
  }

  /**
   * Get current screen stream
   */
  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }
}

// Export singleton instance
export const spaceRoomManager = new SpaceRoomManager();

// Also export the class for testing
export { SpaceRoomManager };
