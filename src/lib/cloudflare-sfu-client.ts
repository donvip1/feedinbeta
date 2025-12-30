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
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();

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
  private initPeerConnection(): RTCPeerConnection {
    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      console.log('[CloudflareSFU] Reusing existing peer connection');
      return this.peerConnection;
    }

    console.log('[CloudflareSFU] Creating new peer connection...');
    
    // Cloudflare uses STUN only - their network handles NAT traversal
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
    });

    // Handle incoming tracks (for listeners receiving audio)
    this.peerConnection.ontrack = (event) => {
      console.log('[CloudflareSFU] ✅ Received remote track:', event.track.kind, 'id:', event.track.id);
      
      if (event.track.kind === 'audio') {
        // Create audio element for playback
        const peerId = event.transceiver?.mid || `remote-${Date.now()}`;
        this.playRemoteAudio(event.track, peerId);
        
        if (this.onTrackCallback) {
          this.onTrackCallback(event.track, peerId);
        }
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

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[CloudflareSFU] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    this.peerConnection.onnegotiationneeded = () => {
      console.log('[CloudflareSFU] Negotiation needed');
    };

    return this.peerConnection;
  }

  /**
   * Play remote audio through an audio element
   */
  private playRemoteAudio(track: MediaStreamTrack, peerId: string): void {
    // Remove existing audio element if any
    const existing = this.remoteAudioElements.get(peerId);
    if (existing) {
      existing.remove();
      this.remoteAudioElements.delete(peerId);
    }

    const audio = document.createElement('audio');
    audio.id = `sfu-audio-${peerId}`;
    audio.autoplay = true;
    audio.srcObject = new MediaStream([track]);
    document.body.appendChild(audio);
    this.remoteAudioElements.set(peerId, audio);

    audio.play().catch((err) => {
      console.warn('[CloudflareSFU] Autoplay blocked:', err);
      // Add click handler to enable audio
      const enableAudio = () => {
        audio.play().catch(console.error);
        document.removeEventListener('click', enableAudio);
      };
      document.addEventListener('click', enableAudio);
    });

    console.log('[CloudflareSFU] 🔊 Playing remote audio for peer:', peerId);
  }

  /**
   * Wait for ICE gathering to complete (or timeout)
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[CloudflareSFU] ICE gathering timeout, proceeding...');
        resolve();
      }, timeoutMs);

      const handler = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', handler);
          console.log('[CloudflareSFU] ICE gathering complete');
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', handler);
    });
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
      
      const pc = this.initPeerConnection();
      
      // Add local audio track
      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track in stream');
      }

      console.log('[CloudflareSFU] Adding audio track to peer connection...');
      
      // Add transceiver for sending audio
      const transceiver = pc.addTransceiver(audioTrack, { 
        direction: 'sendonly',
        streams: [localStream],
      });

      console.log('[CloudflareSFU] Transceiver created, mid:', transceiver.mid);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE candidates to be gathered
      await this.waitForIceGathering(pc);

      // Get the complete local description with ICE candidates
      const localDesc = pc.localDescription;
      console.log('[CloudflareSFU] Sending offer to SFU with ICE candidates...');

      // Push track to SFU with the offer
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'push-track',
          sessionId,
          sdp: localDesc?.sdp || offer.sdp,
          trackName,
        },
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to push track');
      }

      console.log('[CloudflareSFU] Got response from SFU, type:', data.sessionDescription?.type);

      // Handle the response - could be an answer or an offer
      if (data.sessionDescription) {
        if (data.sessionDescription.type === 'answer') {
          // Standard flow: we sent offer, got answer
          console.log('[CloudflareSFU] Setting remote description (answer)...');
          await pc.setRemoteDescription({
            type: 'answer',
            sdp: data.sessionDescription.sdp,
          });
          console.log('[CloudflareSFU] ✅ WebRTC connection established for publishing');
        } else if (data.sessionDescription.type === 'offer') {
          // Server offer flow: need to answer
          console.log('[CloudflareSFU] Got offer from SFU, creating answer...');
          await pc.setRemoteDescription({
            type: 'offer',
            sdp: data.sessionDescription.sdp,
          });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // Wait for ICE gathering for the answer
          await this.waitForIceGathering(pc);
          
          // Send the answer back via renegotiate
          const answerSdp = pc.localDescription?.sdp || answer.sdp;
          await this.renegotiate(sessionId, answerSdp!);
        }
      }

      this.localTrackName = trackName;
      console.log('[CloudflareSFU] ✅ Audio track published successfully');

      return {
        success: true,
        sessionDescription: data.sessionDescription,
        tracks: data.tracks,
      };
    } catch (error) {
      console.error('[CloudflareSFU] ❌ Error publishing audio track:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish track',
      };
    }
  }

  /**
   * Subscribe to remote audio tracks (for listeners)
   * This creates a NEW peer connection for receiving tracks
   */
  async pullTracks(
    sessionId: string,
    remoteTracks: PullTrackRequest[]
  ): Promise<SFUTrackResult> {
    try {
      console.log('[CloudflareSFU] Pulling', remoteTracks.length, 'remote tracks...', remoteTracks);
      
      const pc = this.initPeerConnection();

      // Request tracks from SFU - SFU will send us an offer with the tracks
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

      console.log('[CloudflareSFU] Got response from SFU, type:', data.sessionDescription?.type);

      // Handle the SFU response
      if (data.sessionDescription) {
        if (data.sessionDescription.type === 'offer') {
          // SFU sends us an offer - we need to answer
          console.log('[CloudflareSFU] Got offer from SFU, setting remote description...');
          
          await pc.setRemoteDescription({
            type: 'offer',
            sdp: data.sessionDescription.sdp,
          });

          // Create answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Wait for ICE gathering
          await this.waitForIceGathering(pc);

          // Send answer back via renegotiate to complete the handshake
          const answerSdp = pc.localDescription?.sdp || answer.sdp;
          console.log('[CloudflareSFU] Sending answer to SFU...');
          await this.renegotiate(sessionId, answerSdp!);
          
          console.log('[CloudflareSFU] ✅ WebRTC connection established for receiving');
        } else if (data.sessionDescription.type === 'answer') {
          // Unexpected but handle it
          console.log('[CloudflareSFU] Got answer from SFU (unexpected)...');
          await pc.setRemoteDescription({
            type: 'answer',
            sdp: data.sessionDescription.sdp,
          });
        }
      }

      console.log('[CloudflareSFU] ✅ Tracks pulled successfully');

      return {
        success: true,
        sessionDescription: data.sessionDescription,
        tracks: data.tracks,
      };
    } catch (error) {
      console.error('[CloudflareSFU] ❌ Error pulling tracks:', error);
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
    
    // Remove all audio elements
    this.remoteAudioElements.forEach((audio, peerId) => {
      audio.remove();
    });
    this.remoteAudioElements.clear();

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
