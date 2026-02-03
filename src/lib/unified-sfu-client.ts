/**
 * Unified Cloudflare SFU Client
 * 
 * A single shared client for both live video streaming and live audio spaces.
 * Supports publishing audio/video tracks and subscribing to remote tracks.
 * 
 * Key features:
 * - Single implementation for both video and audio use cases
 * - Automatic reconnection with exponential backoff
 * - Connection state monitoring and callbacks
 * - Audio playback integration via AudioPlaybackManager
 */

import { supabase } from '@/integrations/supabase/client';
import { audioPlaybackManager } from './audio-playback-manager';

// ============= Types =============

export interface SFUSessionResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface SFUTrackResult {
  success: boolean;
  sessionDescription?: RTCSessionDescriptionInit;
  tracks?: TrackInfo[];
  error?: string;
}

interface TrackInfo {
  trackName: string;
  mid: string;
  sessionId: string;
  status: string;
}

interface PullTrackRequest {
  location: string;
  trackName: string;
  sessionId: string;
}

type TrackCallback = (track: MediaStreamTrack, peerId: string) => void;
type ConnectionStateCallback = (state: RTCPeerConnectionState) => void;

// ============= Unified SFU Client =============

export class UnifiedSFUClient {
  private peerConnection: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private localTrackName: string | null = null;
  private localStream: MediaStream | null = null;
  private onTrackCallback: TrackCallback | null = null;
  private onConnectionStateChange: ConnectionStateCallback | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private isDestroyed = false;
  private reconnectAttempts = 0;
  private role: 'publisher' | 'subscriber' | null = null;
  private pendingRenegotiation: Promise<void> | null = null;
  private operationQueue: Promise<any> = Promise.resolve();

  constructor(private readonly clientId: string = `sfu-${Date.now()}`) {
    console.log(`[UnifiedSFU:${this.clientId}] Initialized`);
  }

  /**
   * Ensure operations are serialized to prevent signaling state conflicts
   */
  private async enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const currentQueue = this.operationQueue;
    const newOperation = currentQueue.then(() => operation()).catch((e) => {
      console.error(`[UnifiedSFU:${this.clientId}] Operation failed:`, e);
      throw e;
    });
    this.operationQueue = newOperation.catch(() => {}); // Prevent unhandled rejection
    return newOperation;
  }

  // ============= Session Management =============

  /**
   * Create a new Cloudflare SFU session
   */
  async createSession(): Promise<SFUSessionResult> {
    if (this.isDestroyed) {
      return { success: false, error: 'Client destroyed' };
    }

    try {
      this.cleanup(false); // Clean up without destroying
      
      console.log(`[UnifiedSFU:${this.clientId}] Creating session...`);
      
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: { action: 'create-session' },
      });

      if (error || !data?.success || !data?.sessionId) {
        throw new Error(data?.error || error?.message || 'Failed to create session');
      }

      this.sessionId = data.sessionId;
      this.retryCount = 0;
      console.log(`[UnifiedSFU:${this.clientId}] ✅ Session created: ${this.sessionId.slice(0, 8)}`);
      
      return { success: true, sessionId: data.sessionId };
    } catch (error) {
      console.error(`[UnifiedSFU:${this.clientId}] ❌ Session creation failed:`, error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        await new Promise(r => setTimeout(r, 1000 * this.retryCount));
        return this.createSession();
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create session' 
      };
    }
  }

  // ============= Peer Connection =============

  /**
   * Initialize or reuse peer connection
   */
  private initPeerConnection(forceNew = false): RTCPeerConnection {
    if (!forceNew && this.peerConnection) {
      const state = this.peerConnection.connectionState;
      if (state === 'connected' || state === 'connecting' || state === 'new') {
        return this.peerConnection;
      }
      this.peerConnection.close();
      this.peerConnection = null;
    }

    console.log(`[UnifiedSFU:${this.clientId}] Creating peer connection...`);
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
    });

    this.setupPeerConnectionHandlers();
    return this.peerConnection;
  }

  /**
   * Set up peer connection event handlers
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.ontrack = (event) => {
      console.log(`[UnifiedSFU:${this.clientId}] ✅ Received track:`, {
        kind: event.track.kind,
        id: event.track.id,
        mid: event.transceiver?.mid,
      });
      
      const peerId = event.transceiver?.mid || event.track.id || `remote-${Date.now()}`;
      
      if (event.track.kind === 'audio') {
        audioPlaybackManager.playTrack(peerId, event.track);
      }
      
      // For video tracks (screen share), create video element
      if (event.track.kind === 'video') {
        this.playVideoTrack(event.track, peerId);
      }
      
      if (this.onTrackCallback) {
        this.onTrackCallback(event.track, peerId);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`[UnifiedSFU:${this.clientId}] Connection state: ${state}`);
      
      if (this.onConnectionStateChange && state) {
        this.onConnectionStateChange(state);
      }
      
      if ((state === 'failed' || state === 'disconnected') && !this.isDestroyed) {
        this.handleReconnect();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log(`[UnifiedSFU:${this.clientId}] ICE state: ${state}`);
      
      if (state === 'failed' && !this.isDestroyed) {
        this.peerConnection?.restartIce();
      }
    };
  }

  // ============= Publishing =============

  /**
   * Publish media track (audio or video) - serialized through operation queue
   */
  async publishTrack(
    stream: MediaStream,
    trackName: string,
    kind: 'audio' | 'video' = 'audio'
  ): Promise<SFUTrackResult> {
    return this.enqueueOperation(() => this._publishTrackInternal(stream, trackName, kind));
  }

  private async _publishTrackInternal(
    stream: MediaStream,
    trackName: string,
    kind: 'audio' | 'video'
  ): Promise<SFUTrackResult> {
    // Wait for any pending renegotiation to complete
    if (this.pendingRenegotiation) {
      console.log(`[UnifiedSFU:${this.clientId}] Waiting for pending renegotiation before publish...`);
      await this.pendingRenegotiation;
    }

    if (!this.sessionId) {
      const result = await this.createSession();
      if (!result.success) return result as SFUTrackResult;
    }

    try {
      console.log(`[UnifiedSFU:${this.clientId}] Publishing ${kind} track: ${trackName}`);
      
      this.role = 'publisher';
      this.localStream = stream;
      this.localTrackName = trackName;

      const pc = this.initPeerConnection();
      
      const track = kind === 'audio' 
        ? stream.getAudioTracks()[0] 
        : stream.getVideoTracks()[0];
      
      if (!track) {
        throw new Error(`No ${kind} track in stream`);
      }

      // Add or replace track
      const existingSenders = pc.getSenders().filter(s => s.track?.kind === kind);
      if (existingSenders.length > 0) {
        await existingSenders[0].replaceTrack(track);
      } else {
        pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      }

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.waitForIceGathering(pc);

      // Push to SFU
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'push-track',
          sessionId: this.sessionId,
          trackName,
          sdp: pc.localDescription?.sdp,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to push track');
      }

      // Handle response (this may set pendingRenegotiation)
      await this.handleSdpResponse(pc, data.sessionDescription);

      console.log(`[UnifiedSFU:${this.clientId}] ✅ Track published successfully`);
      
      return { success: true, sessionDescription: data.sessionDescription, tracks: data.tracks };
    } catch (error) {
      console.error(`[UnifiedSFU:${this.clientId}] ❌ Publish failed:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to publish' };
    }
  }

  // ============= Subscribing =============

  /**
   * Subscribe to remote tracks with retry logic - serialized through operation queue
   */
  async pullTracks(remoteTracks: PullTrackRequest[], retryCount = 0): Promise<SFUTrackResult> {
    return this.enqueueOperation(() => this._pullTracksInternal(remoteTracks, retryCount));
  }

  private async _pullTracksInternal(remoteTracks: PullTrackRequest[], retryCount: number): Promise<SFUTrackResult> {
    const maxRetries = 3;
    
    // Wait for any pending renegotiation to complete
    if (this.pendingRenegotiation) {
      console.log(`[UnifiedSFU:${this.clientId}] Waiting for pending renegotiation before pull...`);
      await this.pendingRenegotiation;
    }
    
    if (!this.sessionId) {
      const result = await this.createSession();
      if (!result.success) return result as SFUTrackResult;
    }

    try {
      console.log(`[UnifiedSFU:${this.clientId}] Pulling ${remoteTracks.length} tracks (attempt ${retryCount + 1})...`);
      console.log(`[UnifiedSFU:${this.clientId}] Remote tracks:`, remoteTracks.map(t => ({
        trackName: t.trackName?.slice(0, 30),
        sessionId: t.sessionId?.slice(0, 8),
      })));
      
      this.role = 'subscriber';
      const pc = this.initPeerConnection();

      // Add recvonly transceivers for incoming tracks
      const existingReceivers = pc.getTransceivers().filter(
        t => t.direction === 'recvonly' || t.direction === 'inactive'
      );
      
      // Determine track type from first track (default to audio)
      const trackType = remoteTracks[0]?.trackName?.startsWith('screen-') ? 'video' : 'audio';
      const needed = remoteTracks.length - existingReceivers.length;
      
      for (let i = 0; i < needed; i++) {
        pc.addTransceiver(trackType, { direction: 'recvonly' });
      }

      // Always create offer for pull requests
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.waitForIceGathering(pc);

      // Pull from SFU
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'pull-tracks',
          sessionId: this.sessionId,
          remoteTracks,
          sdp: pc.localDescription?.sdp, // Include SDP for better handling
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to pull tracks');
      }

      // Handle response (this may set pendingRenegotiation)
      await this.handleSdpResponse(pc, data.sessionDescription);

      console.log(`[UnifiedSFU:${this.clientId}] ✅ Tracks pulled successfully, connection state:`, pc.connectionState);
      
      return { success: true, sessionDescription: data.sessionDescription, tracks: data.tracks };
    } catch (error) {
      console.error(`[UnifiedSFU:${this.clientId}] ❌ Pull failed (attempt ${retryCount + 1}):`, error);
      
      // Retry with exponential backoff - call internal directly to stay in queue
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
        console.log(`[UnifiedSFU:${this.clientId}] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return this._pullTracksInternal(remoteTracks, retryCount + 1);
      }
      
      return { success: false, error: error instanceof Error ? error.message : 'Failed to pull tracks' };
    }
  }

  // ============= SDP Handling =============

  /**
   * Handle SDP response from Cloudflare
   */
  private async handleSdpResponse(
    pc: RTCPeerConnection, 
    sessionDescription?: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!sessionDescription) return;

    const signalingState = pc.signalingState;
    
    if (sessionDescription.type === 'answer') {
      if (signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(sessionDescription);
      }
    } else if (sessionDescription.type === 'offer') {
      // This is a server-initiated offer, we need to answer and renegotiate
      // Track this as a pending operation to prevent race conditions
      const renegotiatePromise = (async () => {
        if (signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        
        await pc.setRemoteDescription(sessionDescription);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.waitForIceGathering(pc);
        
        // Send answer back to complete renegotiation
        await this.renegotiateInternal(pc.localDescription?.sdp!);
      })();
      
      this.pendingRenegotiation = renegotiatePromise;
      await renegotiatePromise;
      this.pendingRenegotiation = null;
    }
  }

  /**
   * Renegotiate session - internal implementation
   */
  private async renegotiateInternal(sdp: string): Promise<void> {
    if (!this.sessionId) return;

    console.log(`[UnifiedSFU:${this.clientId}] 🔄 Sending renegotiation answer...`);
    
    const { error, data } = await supabase.functions.invoke('cloudflare-sfu', {
      body: {
        action: 'renegotiate',
        sessionId: this.sessionId,
        sdp,
      },
    });

    if (error) {
      console.error(`[UnifiedSFU:${this.clientId}] ❌ Renegotiate failed:`, error);
      throw error;
    }
    
    console.log(`[UnifiedSFU:${this.clientId}] ✅ Renegotiation complete`);
  }

  /**
   * Public renegotiate method (deprecated - use internal flow)
   */
  private async renegotiate(sdp: string): Promise<void> {
    return this.renegotiateInternal(sdp);
  }

  // ============= ICE Handling =============

  /**
   * Wait for ICE gathering
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, timeoutMs);
      
      const handler = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      
      pc.addEventListener('icegatheringstatechange', handler);
    });
  }

  // ============= Reconnection =============

  /**
   * Handle reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxRetries) {
      console.log(`[UnifiedSFU:${this.clientId}] Reconnect skipped - destroyed or max attempts`);
      return;
    }

    this.reconnectAttempts++;
    const delay = 2000 * this.reconnectAttempts;
    console.log(`[UnifiedSFU:${this.clientId}] Reconnecting in ${delay}ms... (${this.reconnectAttempts}/${this.maxRetries})`);

    await new Promise(r => setTimeout(r, delay));

    if (this.isDestroyed) return;

    try {
      this.peerConnection?.close();
      this.peerConnection = null;
      
      await this.createSession();

      if (this.role === 'publisher' && this.localStream && this.localTrackName) {
        await this.publishTrack(this.localStream, this.localTrackName);
      }

      this.reconnectAttempts = 0;
      console.log(`[UnifiedSFU:${this.clientId}] ✅ Reconnected successfully`);
    } catch (error) {
      console.error(`[UnifiedSFU:${this.clientId}] ❌ Reconnection failed:`, error);
    }
  }

  // ============= Track Management =============

  /**
   * Close a track
   */
  async closeTrack(trackName: string): Promise<boolean> {
    if (!this.sessionId) return false;

    try {
      const { data } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'close-track',
          sessionId: this.sessionId,
          trackName,
        },
      });
      return data?.success || false;
    } catch {
      return false;
    }
  }

  /**
   * Play video track in a video element (for screen sharing)
   */
  private playVideoTrack(track: MediaStreamTrack, peerId: string): void {
    try {
      const existingEl = document.getElementById(`sfu-video-${peerId}`);
      if (existingEl) {
        existingEl.remove();
      }

      const video = document.createElement('video');
      video.id = `sfu-video-${peerId}`;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Video tracks are muted by default
      video.srcObject = new MediaStream([track]);
      video.className = 'fixed inset-0 z-50 w-full h-full object-contain bg-black/90';
      video.style.display = 'none'; // Hidden by default, shown via callback
      document.body.appendChild(video);

      console.log(`[UnifiedSFU:${this.clientId}] 🎥 Video element created for peer:`, peerId);
    } catch (e) {
      console.warn(`[UnifiedSFU:${this.clientId}] Could not create video element:`, e);
    }
  }

  // ============= Callbacks =============

  /**
   * Set track callback
   */
  onTrack(callback: TrackCallback): void {
    this.onTrackCallback = callback;
  }

  /**
   * Set connection state callback
   */
  onStateChange(callback: ConnectionStateCallback): void {
    this.onConnectionStateChange = callback;
  }

  // ============= Getters =============

  getSessionId(): string | null {
    return this.sessionId;
  }

  getLocalTrackName(): string | null {
    return this.localTrackName;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  isConnectionUsable(): boolean {
    if (!this.peerConnection) return false;
    const state = this.peerConnection.connectionState;
    return state === 'connected' || state === 'connecting' || state === 'new';
  }

  // ============= Cleanup =============

  /**
   * Cleanup resources
   */
  cleanup(destroy = true): void {
    console.log(`[UnifiedSFU:${this.clientId}] Cleaning up... (destroy: ${destroy})`);

    if (destroy) {
      this.isDestroyed = true;
    }

    audioPlaybackManager.cleanup();

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn(`[UnifiedSFU:${this.clientId}] Error closing PC:`, e);
      }
      this.peerConnection = null;
    }

    if (destroy && this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.sessionId = null;
    this.localTrackName = null;
    this.onTrackCallback = null;
    this.onConnectionStateChange = null;
    this.retryCount = 0;
    this.reconnectAttempts = 0;

    console.log(`[UnifiedSFU:${this.clientId}] ✅ Cleanup complete`);
  }

  /**
   * Destroy client
   */
  destroy(): void {
    this.cleanup(true);
  }
}

// ============= Factory Functions =============

/**
 * Create a new SFU client instance
 */
export const createUnifiedSFUClient = (id?: string): UnifiedSFUClient => {
  return new UnifiedSFUClient(id);
};

// Export for backward compatibility
export { UnifiedSFUClient as CloudflareSFUClient };
