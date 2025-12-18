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

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
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
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? { width: 1280, height: 720, facingMode: 'user' } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Set up event handlers
      this.setupPeerConnectionHandlers();

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Set up signaling channel
      await this.setupSignaling();

      return this.localStream;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  private setupPeerConnectionHandlers() {
    if (!this.peerConnection) return;

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        await this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote track
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track');
      if (event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Connection state:', state);
      if (state) {
        this.callbacks.onConnectionStateChange(state);
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('ICE connection state:', state);
      if (state) {
        this.callbacks.onIceConnectionStateChange(state);
      }
    };

    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = async () => {
      if (this.isNegotiating) return;
      this.isNegotiating = true;
      
      try {
        await this.createAndSendOffer();
      } catch (error) {
        console.error('Error during negotiation:', error);
      } finally {
        this.isNegotiating = false;
      }
    };
  }

  private async setupSignaling() {
    // Subscribe to incoming signals via Supabase Realtime
    this.signalChannel = supabase
      .channel(`call-signals:${this.callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_id=eq.${this.callId}`,
        },
        async (payload) => {
          const signal = payload.new;
          // Only process signals meant for us
          if (signal.to_user_id === this.userId) {
            await this.handleSignal(signal.signal_data);
          }
        }
      )
      .subscribe();
  }

  private async sendSignal(data: any) {
    try {
      await supabase.from('call_signals').insert({
        call_id: this.callId,
        from_user_id: this.userId,
        to_user_id: this.otherUserId,
        signal_data: data,
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }

  private async handleSignal(data: any) {
    if (!this.peerConnection) return;

    try {
      console.log('Handling signal:', data.type);

      if (data.type === 'offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        await this.sendSignal({
          type: 'answer',
          sdp: { type: answer.type, sdp: answer.sdp },
        });
        
        // Process queued ICE candidates
        this.processQueuedCandidates();
      } else if (data.type === 'answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        // Process queued ICE candidates
        this.processQueuedCandidates();
      } else if (data.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(data.candidate);
        
        if (this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(candidate);
        } else {
          // Queue candidates if remote description not set yet
          this.iceCandidatesQueue.push(candidate);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }

  private async processQueuedCandidates() {
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift()!;
      try {
        await this.peerConnection?.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding queued ICE candidate:', error);
      }
    }
  }

  async createAndSendOffer() {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      await this.sendSignal({
        type: 'offer',
        sdp: { type: offer.type, sdp: offer.sdp },
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
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
  }
}
