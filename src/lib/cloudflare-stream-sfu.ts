/**
 * Cloudflare SFU Client for Live Streaming
 * 
 * This implements a proper SFU (Selective Forwarding Unit) architecture:
 * - Host publishes ONCE to Cloudflare
 * - Cloudflare distributes to ALL viewers
 * - Much more reliable than P2P WebRTC
 */

import { supabase } from '@/integrations/supabase/client';

export interface SFUSession {
  sessionId: string;
  trackName?: string;
}

export interface SFUTrack {
  location: 'local' | 'remote';
  trackName: string;
  sessionId?: string;
  mid?: string;
}

export class CloudflareStreamSFU {
  private sessionId: string | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private trackName: string | null = null;
  private onTrackCallback: ((track: MediaStreamTrack, stream: MediaStream) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isDestroyed = false;

  constructor(private streamId: string, private role: 'host' | 'viewer') {
    console.log(`[CloudflareSFU] Initialized as ${role} for stream ${streamId}`);
  }

  /**
   * Create a new Cloudflare SFU session
   */
  async createSession(): Promise<string> {
    console.log('[CloudflareSFU] Creating session...');
    
    const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
      body: { action: 'create-session' }
    });

    if (error || !data?.success) {
      console.error('[CloudflareSFU] Failed to create session:', error || data?.error);
      throw new Error(data?.error || 'Failed to create session');
    }

    this.sessionId = data.sessionId;
    console.log('[CloudflareSFU] Session created:', this.sessionId?.slice(0, 8));
    return this.sessionId;
  }

  /**
   * Initialize WebRTC peer connection for publishing (host)
   */
  async initializePublisher(stream: MediaStream): Promise<void> {
    if (!this.sessionId) {
      await this.createSession();
    }

    this.localStream = stream;
    console.log('[CloudflareSFU] Initializing publisher with', stream.getTracks().length, 'tracks');

    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
    });

    // Add tracks to peer connection
    stream.getTracks().forEach((track, index) => {
      console.log(`[CloudflareSFU] Adding ${track.kind} track to PC`);
      this.pc!.addTrack(track, stream);
    });

    // Create and set local description
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await this.waitForIceGathering();

    const localSdp = this.pc.localDescription?.sdp;
    if (!localSdp) {
      throw new Error('No local SDP available');
    }

    // Generate a unique track name for this stream
    this.trackName = `stream-${this.streamId}-${Date.now()}`;

    console.log('[CloudflareSFU] Pushing track:', this.trackName);

    // Push the track to Cloudflare
    const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
      body: {
        action: 'push-track',
        sessionId: this.sessionId,
        trackName: this.trackName,
        sdp: localSdp,
      }
    });

    if (error || !data?.success) {
      console.error('[CloudflareSFU] Failed to push track:', error || data?.error);
      throw new Error(data?.error || 'Failed to push track');
    }

    // Set remote description from Cloudflare's answer
    if (data.sessionDescription) {
      console.log('[CloudflareSFU] Setting remote description (answer)');
      await this.pc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));
    }

    // Store session info in database for viewers to find
    await this.storeSessionInfo();

    console.log('[CloudflareSFU] Publisher initialized successfully');
    
    // Monitor connection state
    this.setupConnectionMonitoring();
  }

  /**
   * Initialize WebRTC peer connection for viewing (viewer)
   */
  async initializeViewer(onTrack: (track: MediaStreamTrack, stream: MediaStream) => void): Promise<void> {
    this.onTrackCallback = onTrack;
    
    if (!this.sessionId) {
      await this.createSession();
    }

    console.log('[CloudflareSFU] Initializing viewer...');

    // Get host session info from database
    const hostSession = await this.getHostSessionInfo();
    if (!hostSession) {
      throw new Error('Host stream not available');
    }

    console.log('[CloudflareSFU] Found host session:', hostSession.sessionId?.slice(0, 8), 'track:', hostSession.trackName);

    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
    });

    // Handle incoming tracks
    this.pc.ontrack = (event) => {
      console.log('[CloudflareSFU] Received track:', event.track.kind);
      if (this.onTrackCallback && event.streams[0]) {
        this.onTrackCallback(event.track, event.streams[0]);
      }
    };

    // Pull the host's track from Cloudflare
    const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
      body: {
        action: 'pull-tracks',
        sessionId: this.sessionId,
        remoteTracks: [{
          location: 'remote',
          sessionId: hostSession.sessionId,
          trackName: hostSession.trackName,
        }]
      }
    });

    if (error || !data?.success) {
      console.error('[CloudflareSFU] Failed to pull tracks:', error || data?.error);
      throw new Error(data?.error || 'Failed to pull tracks');
    }

    // Handle the offer from Cloudflare
    if (data.sessionDescription) {
      console.log('[CloudflareSFU] Setting remote description (offer)');
      await this.pc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription));

      // Create and send answer
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // Wait for ICE gathering
      await this.waitForIceGathering();

      // Send answer back to Cloudflare
      const { error: renegotiateError } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'renegotiate',
          sessionId: this.sessionId,
          sdp: this.pc.localDescription?.sdp,
        }
      });

      if (renegotiateError) {
        console.warn('[CloudflareSFU] Renegotiate warning:', renegotiateError);
      }
    }

    console.log('[CloudflareSFU] Viewer initialized successfully');

    // Monitor connection state
    this.setupConnectionMonitoring();
  }

  /**
   * Wait for ICE gathering to complete
   */
  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc?.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      this.pc?.addEventListener('icegatheringstatechange', checkState);

      // Timeout fallback
      setTimeout(() => {
        this.pc?.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 3000);
    });
  }

  /**
   * Store session info in database for viewers to find
   */
  private async storeSessionInfo(): Promise<void> {
    // Use RPC or direct update - cast to any to avoid type issues with new columns
    const { error } = await supabase
      .from('live_streams')
      .update({
        cloudflare_session_id: this.sessionId,
        sfu_track_name: this.trackName,
      } as any)
      .eq('id', this.streamId);

    if (error) {
      console.error('[CloudflareSFU] Failed to store session info:', error);
    }
  }

  /**
   * Get host session info from database
   */
  private async getHostSessionInfo(): Promise<SFUSession | null> {
    // Cast to any to avoid type issues with new columns
    const { data, error } = await supabase
      .from('live_streams')
      .select('cloudflare_session_id, sfu_track_name')
      .eq('id', this.streamId)
      .single() as any;

    if (error || !data?.cloudflare_session_id) {
      console.error('[CloudflareSFU] Failed to get host session:', error);
      return null;
    }

    return {
      sessionId: data.cloudflare_session_id,
      trackName: data.sfu_track_name,
    };
  }

  /**
   * Setup connection state monitoring and auto-reconnect
   */
  private setupConnectionMonitoring(): void {
    if (!this.pc) return;

    this.pc.onconnectionstatechange = () => {
      console.log('[CloudflareSFU] Connection state:', this.pc?.connectionState);
      
      if (this.pc?.connectionState === 'failed' && !this.isDestroyed) {
        this.handleReconnect();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[CloudflareSFU] ICE state:', this.pc?.iceConnectionState);
      
      if (this.pc?.iceConnectionState === 'failed' && !this.isDestroyed) {
        this.pc.restartIce();
      }
    };
  }

  /**
   * Handle reconnection attempts
   */
  private async handleReconnect(): Promise<void> {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[CloudflareSFU] Max reconnect attempts reached or destroyed');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[CloudflareSFU] Reconnecting... attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    try {
      // Close existing connection
      this.pc?.close();
      this.pc = null;

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));

      if (this.isDestroyed) return;

      // Create new session
      await this.createSession();

      // Reinitialize based on role
      if (this.role === 'host' && this.localStream) {
        await this.initializePublisher(this.localStream);
      } else if (this.role === 'viewer' && this.onTrackCallback) {
        await this.initializeViewer(this.onTrackCallback);
      }

      this.reconnectAttempts = 0;
      console.log('[CloudflareSFU] Reconnected successfully');
    } catch (error) {
      console.error('[CloudflareSFU] Reconnection failed:', error);
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): RTCPeerConnectionState | 'not-connected' {
    return this.pc?.connectionState || 'not-connected';
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get track name
   */
  getTrackName(): string | null {
    return this.trackName;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.pc?.connectionState === 'connected';
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    console.log('[CloudflareSFU] Destroying...');
    this.isDestroyed = true;

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear session info from database if host
    if (this.role === 'host' && this.sessionId) {
      await supabase
        .from('live_streams')
        .update({
          cloudflare_session_id: null,
          sfu_track_name: null,
        } as any)
        .eq('id', this.streamId);
    }

    console.log('[CloudflareSFU] Destroyed');
  }
}
