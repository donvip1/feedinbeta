/**
 * Cloudflare SFU Client
 * 
 * Client-side wrapper for interacting with Cloudflare Realtime SFU via edge function.
 * Manages WebRTC connections to the SFU for audio streaming in Live Spaces.
 */

import { supabase } from '@/integrations/supabase/client';

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

export interface SFUSessionResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface SFUTrackResult {
  success: boolean;
  sessionDescription?: RTCSessionDescriptionInit;
  tracks?: TrackInfo[];
  requiresImmediateRenegotiation?: boolean;
  error?: string;
}

class CloudflareSFUClient {
  private peerConnection: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private localTrackName: string | null = null;
  private onTrackCallback: ((track: MediaStreamTrack, peerId: string) => void) | null = null;
  private onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;

  /**
   * Create a new Cloudflare SFU session
   */
  async createSession(): Promise<SFUSessionResult> {
    try {
      console.log('[CloudflareSFU] Creating new session...');
      
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: { action: 'create-session' },
      });

      if (error) throw error;
      
      if (!data.success || !data.sessionId) {
        throw new Error(data.error || 'Failed to create session');
      }

      this.sessionId = data.sessionId;
      console.log('[CloudflareSFU] Session created:', this.sessionId.slice(0, 8));
      
      return { success: true, sessionId: data.sessionId };
    } catch (error) {
      console.error('[CloudflareSFU] Error creating session:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create session' 
      };
    }
  }

  /**
   * Initialize the peer connection to Cloudflare SFU
   */
  async initPeerConnection(): Promise<RTCPeerConnection> {
    if (this.peerConnection) {
      console.log('[CloudflareSFU] Reusing existing peer connection');
      return this.peerConnection;
    }

    console.log('[CloudflareSFU] Creating new peer connection...');
    
    // Cloudflare uses STUN only - their network handles NAT traversal
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      bundlePolicy: 'max-bundle',
    });

    // Handle incoming tracks (for listeners receiving audio)
    this.peerConnection.ontrack = (event) => {
      console.log('[CloudflareSFU] Received track:', event.track.kind);
      if (this.onTrackCallback && event.track.kind === 'audio') {
        // Extract peer ID from track info if available
        const peerId = event.transceiver?.mid || 'remote';
        this.onTrackCallback(event.track, peerId);
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[CloudflareSFU] Connection state:', state);
      if (this.onConnectionStateChange && state) {
        this.onConnectionStateChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[CloudflareSFU] ICE state:', this.peerConnection?.iceConnectionState);
    };

    return this.peerConnection;
  }

  /**
   * Publish local audio track to the SFU (for hosts/speakers)
   */
  async publishAudioTrack(
    localStream: MediaStream, 
    sessionId: string,
    trackName: string
  ): Promise<SFUTrackResult> {
    try {
      console.log('[CloudflareSFU] Publishing audio track:', trackName);
      
      const pc = await this.initPeerConnection();
      
      // Add local audio track
      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track in stream');
      }

      // Add transceiver for sending audio
      const transceiver = pc.addTransceiver(audioTrack, { 
        direction: 'sendonly',
        streams: [localStream],
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[CloudflareSFU] Sending offer to SFU...');

      // Push track to SFU
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'push-track',
          sessionId,
          sdp: offer.sdp,
          trackName,
        },
      });

      if (error) throw error;
      
      if (!data.success || !data.sessionDescription) {
        throw new Error(data.error || 'Failed to push track');
      }

      // Set remote answer
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: data.sessionDescription.sdp,
      });

      this.localTrackName = trackName;
      console.log('[CloudflareSFU] Audio track published successfully');

      return {
        success: true,
        sessionDescription: data.sessionDescription,
        tracks: data.tracks,
      };
    } catch (error) {
      console.error('[CloudflareSFU] Error publishing audio track:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish track',
      };
    }
  }

  /**
   * Subscribe to remote audio tracks (for listeners)
   */
  async pullTracks(
    sessionId: string,
    remoteTracks: PullTrackRequest[]
  ): Promise<SFUTrackResult> {
    try {
      console.log('[CloudflareSFU] Pulling', remoteTracks.length, 'remote tracks...');
      
      const pc = await this.initPeerConnection();

      // Add recv-only transceivers for each remote track
      for (const track of remoteTracks) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      // Request tracks from SFU
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'pull-tracks',
          sessionId,
          remoteTracks,
        },
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to pull tracks');
      }

      // If we got an offer from the server, we need to answer it
      if (data.sessionDescription?.type === 'offer') {
        await pc.setRemoteDescription({
          type: 'offer',
          sdp: data.sessionDescription.sdp,
        });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send answer back via renegotiate
        if (data.requiresImmediateRenegotiation) {
          await this.renegotiate(sessionId, answer.sdp!);
        }
      }

      console.log('[CloudflareSFU] Tracks pulled successfully');

      return {
        success: true,
        sessionDescription: data.sessionDescription,
        tracks: data.tracks,
      };
    } catch (error) {
      console.error('[CloudflareSFU] Error pulling tracks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pull tracks',
      };
    }
  }

  /**
   * Renegotiate the session (after track changes)
   */
  async renegotiate(sessionId: string, sdp: string): Promise<SFUTrackResult> {
    try {
      console.log('[CloudflareSFU] Renegotiating session...');

      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'renegotiate',
          sessionId,
          sdp,
        },
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to renegotiate');
      }

      console.log('[CloudflareSFU] Renegotiation complete');
      return { success: true, sessionDescription: data.sessionDescription };
    } catch (error) {
      console.error('[CloudflareSFU] Error renegotiating:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to renegotiate',
      };
    }
  }

  /**
   * Close a specific track
   */
  async closeTrack(sessionId: string, trackName: string): Promise<boolean> {
    try {
      console.log('[CloudflareSFU] Closing track:', trackName);

      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'close-track',
          sessionId,
          trackName,
        },
      });

      if (error) throw error;
      
      console.log('[CloudflareSFU] Track closed');
      return data.success;
    } catch (error) {
      console.error('[CloudflareSFU] Error closing track:', error);
      return false;
    }
  }

  /**
   * Set callback for receiving remote tracks
   */
  onTrack(callback: (track: MediaStreamTrack, peerId: string) => void) {
    this.onTrackCallback = callback;
  }

  /**
   * Set callback for connection state changes
   */
  onStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.onConnectionStateChange = callback;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get current peer connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    console.log('[CloudflareSFU] Cleaning up...');
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.sessionId = null;
    this.localTrackName = null;
    this.onTrackCallback = null;
    this.onConnectionStateChange = null;
  }
}

// Export singleton instance
export const cloudflareSFU = new CloudflareSFUClient();

// Also export the class for testing
export { CloudflareSFUClient };
