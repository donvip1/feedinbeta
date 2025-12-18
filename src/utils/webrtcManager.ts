import { supabase } from '@/integrations/supabase/client';

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onError: (error: Error) => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callId: string;
  private userId: string;
  private otherUserId: string;
  private callbacks: WebRTCCallbacks;
  private signalChannel: ReturnType<typeof supabase.channel> | null = null;
  private iceCandidatesQueue: RTCIceCandidate[] = [];
  private isNegotiating = false;
  private hasReceivedOffer = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  constructor(
    callId: string,
    userId: string,
    otherUserId: string,
    callbacks: WebRTCCallbacks
  ) {
    this.callId = callId;
    this.userId = userId;
    this.otherUserId = otherUserId;
    this.callbacks = callbacks;
  }

  async initialize(isVideo: boolean): Promise<MediaStream> {
    try {
      console.log('[WebRTC] Initializing...');
      
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      console.log('[WebRTC] Got local stream with tracks:', this.localStream.getTracks().map(t => t.kind));

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        console.log('[WebRTC] Adding track:', track.kind);
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Set up signaling channel using Supabase Realtime broadcast
      await this.setupSignaling();

      // Set connection timeout
      this.setConnectionTimeout();

      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Error initializing:', error);
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  private setConnectionTimeout() {
    // Clear any existing timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    // Set a 60-second timeout for connection establishment (increased from 30s)
    // This gives enough time for signaling and ICE negotiation
    this.connectionTimeout = setTimeout(() => {
      if (this.peerConnection?.connectionState !== 'connected' && 
          this.peerConnection?.iceConnectionState !== 'connected' &&
          this.peerConnection?.iceConnectionState !== 'completed') {
        console.error('[WebRTC] Connection timeout - failed to connect within 60 seconds');
        this.callbacks.onError(new Error('Connection timeout. The other user may not be available.'));
      }
    }, 60000);
  }

  private setupPeerConnectionHandlers() {
    if (!this.peerConnection) return;

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate:', event.candidate.candidate.substring(0, 50));
        await this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          from: this.userId,
        });
      } else {
        console.log('[WebRTC] ICE gathering complete');
      }
    };

    // Handle ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Handle remote track
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (event.streams[0]) {
        console.log('[WebRTC] Remote stream has', event.streams[0].getTracks().length, 'tracks');
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state:', state);
      
      if (state === 'connected') {
        // Clear timeout on successful connection
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.reconnectAttempts = 0;
      }
      
      if (state) {
        this.callbacks.onConnectionStateChange(state);
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[WebRTC] ICE connection state:', state);
      
      if (state === 'connected' || state === 'completed') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
      }
      
      // Handle disconnection - attempt reconnection
      if (state === 'disconnected' && this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log('[WebRTC] Attempting to recover connection...');
        this.reconnectAttempts++;
      }
      
      if (state) {
        this.callbacks.onIceConnectionStateChange(state);
      }
    };

    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', this.peerConnection?.signalingState);
      this.isNegotiating = this.peerConnection?.signalingState !== 'stable';
    };
  }

  private async setupSignaling(): Promise<void> {
    console.log('[WebRTC] Setting up Realtime signaling channel for call:', this.callId);
    
    return new Promise((resolve, reject) => {
      // Use Supabase Realtime broadcast for signaling - much faster than database inserts
      this.signalChannel = supabase
        .channel(`call-signal:${this.callId}`, {
          config: {
            broadcast: { self: false },
          }
        })
        .on('broadcast', { event: 'signal' }, async (payload) => {
          const signal = payload.payload;
          // Only process signals meant for us
          if (signal.from !== this.userId) {
            console.log('[WebRTC] Received signal:', signal.type);
            await this.handleSignal(signal);
          }
        })
        .subscribe((status) => {
          console.log('[WebRTC] Signal channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('[WebRTC] Ready to exchange signals');
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Failed to setup signaling channel'));
          }
        });
      
      // Timeout after 10 seconds if channel doesn't subscribe
      setTimeout(() => {
        if (this.signalChannel) {
          resolve(); // Proceed anyway after timeout
        }
      }, 10000);
    });
  }

  private async sendSignal(data: any) {
    if (!this.signalChannel) {
      console.error('[WebRTC] No signal channel available');
      return;
    }

    try {
      await this.signalChannel.send({
        type: 'broadcast',
        event: 'signal',
        payload: data,
      });
      console.log('[WebRTC] Signal sent:', data.type);
    } catch (error) {
      console.error('[WebRTC] Error sending signal:', error);
    }
  }

  private async handleSignal(data: any) {
    if (!this.peerConnection) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    try {
      if (data.type === 'offer') {
        console.log('[WebRTC] Processing offer');
        
        // Check if we can accept this offer
        if (this.peerConnection.signalingState !== 'stable') {
          console.log('[WebRTC] Ignoring offer - not in stable state');
          return;
        }
        
        this.hasReceivedOffer = true;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log('[WebRTC] Remote description set (offer)');
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        console.log('[WebRTC] Local description set (answer)');
        
        await this.sendSignal({
          type: 'answer',
          sdp: { type: answer.type, sdp: answer.sdp },
          from: this.userId,
        });
        
        // Process queued ICE candidates
        await this.processQueuedCandidates();
        
      } else if (data.type === 'answer') {
        console.log('[WebRTC] Processing answer');
        
        if (this.peerConnection.signalingState !== 'have-local-offer') {
          console.log('[WebRTC] Ignoring answer - not in have-local-offer state');
          return;
        }
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log('[WebRTC] Remote description set (answer)');
        
        // Process queued ICE candidates
        await this.processQueuedCandidates();
        
      } else if (data.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(data.candidate);
        
        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
          console.log('[WebRTC] Adding ICE candidate directly');
          await this.peerConnection.addIceCandidate(candidate);
        } else {
          console.log('[WebRTC] Queueing ICE candidate');
          this.iceCandidatesQueue.push(candidate);
        }
      }
    } catch (error) {
      console.error('[WebRTC] Error handling signal:', error);
    }
  }

  private async processQueuedCandidates() {
    console.log('[WebRTC] Processing', this.iceCandidatesQueue.length, 'queued ICE candidates');
    
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift()!;
      try {
        await this.peerConnection?.addIceCandidate(candidate);
        console.log('[WebRTC] Added queued ICE candidate');
      } catch (error) {
        console.error('[WebRTC] Error adding queued ICE candidate:', error);
      }
    }
  }

  async createAndSendOffer() {
    if (!this.peerConnection) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    // Don't create offer if we already received one
    if (this.hasReceivedOffer) {
      console.log('[WebRTC] Already received offer, not creating one');
      return;
    }

    if (this.isNegotiating) {
      console.log('[WebRTC] Already negotiating, skipping offer');
      return;
    }

    try {
      this.isNegotiating = true;
      console.log('[WebRTC] Creating offer...');
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] Local description set (offer)');
      
      await this.sendSignal({
        type: 'offer',
        sdp: { type: offer.type, sdp: offer.sdp },
        from: this.userId,
      });
      
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      throw error;
    } finally {
      this.isNegotiating = false;
    }
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    
    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    
    return audioTracks[0]?.enabled ?? false;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;
    
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    
    return videoTracks[0]?.enabled ?? false;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async cleanup() {
    console.log('[WebRTC] Cleaning up...');
    
    // Clear timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Stop all local tracks
    this.localStream?.getTracks().forEach(track => {
      track.stop();
    });

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Unsubscribe from signal channel
    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    this.localStream = null;
    this.iceCandidatesQueue = [];
    this.hasReceivedOffer = false;
    this.isNegotiating = false;
    
    console.log('[WebRTC] Cleanup complete');
  }
}
