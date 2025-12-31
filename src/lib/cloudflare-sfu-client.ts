/**
 * Cloudflare SFU Client
 * 
 * Client-side wrapper for interacting with Cloudflare Realtime SFU via edge function.
 * Manages WebRTC connections to the SFU for audio streaming in Live Spaces.
 * 
 * NOTE: Each instance manages ONE session. Create new instances per user/space.
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
  private retryCount = 0;
  private maxRetries = 3;
  private isInitialized = false;

  /**
   * Create a new Cloudflare SFU session
   */
  async createSession(): Promise<SFUSessionResult> {
    try {
      // Always cleanup before creating new session
      this.cleanup();
      
      console.log('[CloudflareSFU] Creating new session...');
      
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: { action: 'create-session' },
      });

      if (error) {
        console.error('[CloudflareSFU] Edge function error:', error);
        throw error;
      }
      
      if (!data.success || !data.sessionId) {
        console.error('[CloudflareSFU] Session creation failed:', data.error);
        throw new Error(data.error || 'Failed to create session');
      }

      this.sessionId = data.sessionId;
      this.isInitialized = true;
      this.retryCount = 0;
      console.log('[CloudflareSFU] ✅ Session created:', this.sessionId.slice(0, 8));
      
      return { success: true, sessionId: data.sessionId };
    } catch (error) {
      console.error('[CloudflareSFU] ❌ Error creating session:', error);
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log('[CloudflareSFU] Retrying session creation, attempt:', this.retryCount);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        return this.createSession();
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create session' 
      };
    }
  }

  /**
   * Initialize the peer connection to Cloudflare SFU
   * Creates a NEW connection if the current one is unusable
   */
  private initPeerConnection(forceNew: boolean = false): RTCPeerConnection {
    // Check if existing connection is still usable
    if (!forceNew && this.peerConnection) {
      const state = this.peerConnection.connectionState;
      if (state === 'connected' || state === 'connecting' || state === 'new') {
        console.log('[CloudflareSFU] Reusing existing peer connection, state:', state);
        return this.peerConnection;
      }
      // Connection is in failed/closed/disconnected state, clean it up
      console.log('[CloudflareSFU] Existing connection unusable, state:', state);
      this.peerConnection.close();
      this.peerConnection = null;
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
      console.log('[CloudflareSFU] ✅ Received remote track:', {
        kind: event.track.kind,
        id: event.track.id,
        readyState: event.track.readyState,
        enabled: event.track.enabled,
        muted: event.track.muted,
        mid: event.transceiver?.mid,
        streams: event.streams.length,
      });
      
      if (event.track.kind === 'audio') {
        // Create a unique peerId based on mid or track id
        const peerId = event.transceiver?.mid || event.track.id || `remote-${Date.now()}`;
        
        // Play audio through element
        this.playRemoteAudio(event.track, peerId);
        
        // Notify callback
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
      
      // Handle connection failures
      if (state === 'failed' || state === 'disconnected') {
        console.error('[CloudflareSFU] Connection failed/disconnected - may need to recreate session');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[CloudflareSFU] ICE state:', this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[CloudflareSFU] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[CloudflareSFU] ICE candidate:', event.candidate.type, event.candidate.protocol);
      }
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
    console.log('[CloudflareSFU] 🔊 Setting up audio playback for peer:', peerId);
    
    // Remove any existing audio element for this peer
    const existingAudio = this.remoteAudioElements.get(peerId);
    if (existingAudio) {
      console.log('[CloudflareSFU] Removing existing audio element for peer:', peerId);
      existingAudio.pause();
      existingAudio.srcObject = null;
      existingAudio.remove();
      this.remoteAudioElements.delete(peerId);
    }
    
    // Also clean up any orphaned elements
    document.querySelectorAll(`[id^="sfu-audio-${peerId}"]`).forEach(el => {
      console.log('[CloudflareSFU] Removing orphaned audio element:', el.id);
      el.remove();
    });

    const stream = new MediaStream([track]);
    
    const audio = document.createElement('audio');
    audio.id = `sfu-audio-${peerId}-${Date.now()}`;
    audio.autoplay = true;
    (audio as any).playsInline = true;
    audio.srcObject = stream;
    audio.volume = 1.0;
    audio.muted = false;
    
    // Keep element in DOM but hidden
    audio.style.position = 'fixed';
    audio.style.left = '-9999px';
    audio.style.top = '-9999px';
    audio.style.opacity = '0';
    audio.style.pointerEvents = 'none';
    
    document.body.appendChild(audio);
    this.remoteAudioElements.set(peerId, audio);

    // Handle track lifecycle
    track.onended = () => {
      console.log('[CloudflareSFU] Track ended for peer:', peerId);
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudioElements.delete(peerId);
    };
    
    track.onmute = () => {
      console.log('[CloudflareSFU] Track muted for peer:', peerId);
    };
    
    track.onunmute = () => {
      console.log('[CloudflareSFU] Track unmuted for peer:', peerId);
      audio.play().catch(err => console.warn('[CloudflareSFU] Resume failed:', err));
    };

    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('[CloudflareSFU] 🔊 Audio playing for peer:', peerId);
      }).catch((err) => {
        console.warn('[CloudflareSFU] Autoplay blocked:', err.name);
        // Add click handler to enable audio
        const enableAudio = async () => {
          try {
            await audio.play();
            console.log('[CloudflareSFU] 🔊 Audio enabled after interaction for peer:', peerId);
          } catch (playErr) {
            console.error('[CloudflareSFU] Still cannot play:', playErr);
          }
          document.removeEventListener('click', enableAudio, true);
          document.removeEventListener('touchstart', enableAudio, true);
        };
        document.addEventListener('click', enableAudio, true);
        document.addEventListener('touchstart', enableAudio, true);
      });
    }

    console.log('[CloudflareSFU] 🔊 Created audio element:', audio.id);
  }

  /**
   * Wait for ICE gathering to complete (or timeout)
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
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
      console.log('[CloudflareSFU] Publishing audio track:', trackName, 'to session:', sessionId.slice(0, 8));
      
      // Use existing peer connection or create new one - don't force new for better stability
      const pc = this.initPeerConnection(false);
      
      // Add local audio track
      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track in stream');
      }

      console.log('[CloudflareSFU] Audio track info:', {
        id: audioTrack.id,
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
      });
      
      // Check if track is already added
      const existingSenders = pc.getSenders().filter(s => s.track?.kind === 'audio');
      if (existingSenders.length > 0) {
        console.log('[CloudflareSFU] Replacing existing audio track');
        await existingSenders[0].replaceTrack(audioTrack);
      } else {
        // Add transceiver for sending audio
        const transceiver = pc.addTransceiver(audioTrack, { 
          direction: 'sendonly',
          streams: [localStream],
        });
        console.log('[CloudflareSFU] Transceiver created, mid:', transceiver.mid);
      }

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE candidates to be gathered
      await this.waitForIceGathering(pc);

      // Get the complete local description with ICE candidates
      const localDesc = pc.localDescription;
      console.log('[CloudflareSFU] Sending offer to SFU...');

      // Push track to SFU with the offer
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'push-track',
          sessionId,
          sdp: localDesc?.sdp || offer.sdp,
          trackName,
        },
      });

      if (error) {
        console.error('[CloudflareSFU] Push track edge function error:', error);
        throw error;
      }
      
      if (!data.success) {
        console.error('[CloudflareSFU] Push track failed:', data.error);
        throw new Error(data.error || 'Failed to push track');
      }

      console.log('[CloudflareSFU] Got response from SFU:', {
        type: data.sessionDescription?.type,
        hasDescription: !!data.sessionDescription,
      });

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
      console.log('[CloudflareSFU] ✅ Audio track published successfully, connection state:', pc.connectionState);

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
   */
  async pullTracks(
    sessionId: string,
    remoteTracks: PullTrackRequest[]
  ): Promise<SFUTrackResult> {
    try {
      console.log('[CloudflareSFU] Pulling', remoteTracks.length, 'remote tracks...');
      console.log('[CloudflareSFU] Remote tracks to pull:', JSON.stringify(remoteTracks, null, 2));
      
      // Use existing connection or create new one
      const pc = this.initPeerConnection();
      
      // Log current connection state
      console.log('[CloudflareSFU] Current peer connection state:', pc.connectionState, 'signaling:', pc.signalingState);

      // Add recv-only transceivers for each remote track we expect
      // Only add if not already present
      const existingReceivers = pc.getTransceivers().filter(t => t.direction === 'recvonly' || t.direction === 'inactive');
      const neededTransceivers = remoteTracks.length - existingReceivers.length;
      
      for (let i = 0; i < neededTransceivers; i++) {
        console.log('[CloudflareSFU] Adding recvonly transceiver for track', i);
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      // If connection is not established yet, we need to create an offer first
      if (pc.signalingState === 'stable' && pc.connectionState !== 'connected') {
        console.log('[CloudflareSFU] Creating initial offer before pulling tracks...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.waitForIceGathering(pc);
      }

      // Request tracks from SFU - SFU will send us an offer with the tracks
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'pull-tracks',
          sessionId,
          remoteTracks,
        },
      });

      if (error) {
        console.error('[CloudflareSFU] Pull tracks edge function error:', error);
        throw error;
      }
      
      if (!data.success) {
        console.error('[CloudflareSFU] Pull tracks failed:', data.error);
        throw new Error(data.error || 'Failed to pull tracks');
      }

      console.log('[CloudflareSFU] Got response from SFU:', {
        type: data.sessionDescription?.type,
        hasDescription: !!data.sessionDescription,
        tracksCount: data.tracks?.length,
      });

      // Handle the SFU response
      if (data.sessionDescription) {
        const signalingState = pc.signalingState;
        console.log('[CloudflareSFU] Signaling state before handling response:', signalingState);
        
        if (data.sessionDescription.type === 'offer') {
          // SFU sends us an offer - we need to answer
          console.log('[CloudflareSFU] Got offer from SFU, setting remote description...');
          
          // If we're in have-local-offer state, we need to rollback first
          if (signalingState === 'have-local-offer') {
            console.log('[CloudflareSFU] Rolling back local offer before setting remote...');
            await pc.setLocalDescription({ type: 'rollback' });
          }
          
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
          
          console.log('[CloudflareSFU] ✅ WebRTC connection established for receiving, state:', pc.connectionState);
        } else if (data.sessionDescription.type === 'answer') {
          // Got answer back - set it
          console.log('[CloudflareSFU] Got answer from SFU...');
          if (signalingState === 'have-local-offer') {
            await pc.setRemoteDescription({
              type: 'answer',
              sdp: data.sessionDescription.sdp,
            });
          }
        }
      }

      console.log('[CloudflareSFU] ✅ Tracks pulled successfully, connection state:', pc.connectionState);

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
      console.log('[CloudflareSFU] Renegotiating session:', sessionId.slice(0, 8));

      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'renegotiate',
          sessionId,
          sdp,
        },
      });

      if (error) {
        console.error('[CloudflareSFU] Renegotiate edge function error:', error);
        throw error;
      }
      
      if (!data.success) {
        console.error('[CloudflareSFU] Renegotiate failed:', data.error);
        throw new Error(data.error || 'Failed to renegotiate');
      }

      console.log('[CloudflareSFU] ✅ Renegotiation complete');
      return { success: true, sessionDescription: data.sessionDescription };
    } catch (error) {
      console.error('[CloudflareSFU] ❌ Error renegotiating:', error);
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

      if (error) {
        console.warn('[CloudflareSFU] Close track error (may be expected if session ended):', error);
        return false;
      }
      
      console.log('[CloudflareSFU] Track closed');
      return data?.success || false;
    } catch (error) {
      console.warn('[CloudflareSFU] Error closing track (may be expected):', error);
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
   * Check if connection is usable
   */
  isConnectionUsable(): boolean {
    if (!this.peerConnection) return false;
    const state = this.peerConnection.connectionState;
    return state === 'connected' || state === 'connecting' || state === 'new';
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    console.log('[CloudflareSFU] Cleaning up...');
    
    // Remove all audio elements
    this.remoteAudioElements.forEach((audio, peerId) => {
      console.log('[CloudflareSFU] Removing audio element for peer:', peerId);
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.remoteAudioElements.clear();
    
    // Also remove any orphaned elements
    document.querySelectorAll('[id^="sfu-audio-"]').forEach(el => {
      el.remove();
    });

    if (this.peerConnection) {
      console.log('[CloudflareSFU] Closing peer connection');
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('[CloudflareSFU] Error closing peer connection:', e);
      }
      this.peerConnection = null;
    }

    this.sessionId = null;
    this.localTrackName = null;
    this.onTrackCallback = null;
    this.onConnectionStateChange = null;
    this.retryCount = 0;
    this.isInitialized = false;
    
    console.log('[CloudflareSFU] ✅ Cleanup complete');
  }
}

// Factory function to create new instances
export const createSFUClient = (): CloudflareSFUClient => {
  return new CloudflareSFUClient();
};

// Export singleton instance for backward compatibility
export const cloudflareSFU = new CloudflareSFUClient();

// Also export the class for testing
export { CloudflareSFUClient };
