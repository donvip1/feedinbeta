/**
 * WhatsApp-Style P2P WebRTC Call Manager
 * Uses Supabase Realtime for signaling (SDP offer/answer + ICE candidates)
 * Fetches dynamic TURN credentials for reliable NAT traversal
 */

import { supabase } from '@/integrations/supabase/client';

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'failed' | 'ended';

interface P2PCallbacks {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onStatusChange: (status: CallStatus, message?: string) => void;
  onError: (error: Error) => void;
}

interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'ready';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

export class WebRTCP2PManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalChannel: any = null;
  private callId: string;
  private userId: string;
  private otherUserId: string;
  private callbacks: P2PCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isConnected = false;
  private hasRemoteDescription = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private processedSignalIds = new Set<string>();
  private isCaller = false;
  private receiverReady = false;
  private pendingOffer: RTCSessionDescriptionInit | null = null;
  private iceServers: RTCIceServer[] = [];
  private initRetryCount = 0;
  private maxRetries = 3;

  // Default fallback STUN/TURN servers
  private static readonly DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65c92f6d9f6e5f9ef455',
      credential: 'uJE/KGrh5vKVE7ey',
    },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65c92f6d9f6e5f9ef455',
      credential: 'uJE/KGrh5vKVE7ey',
    },
  ];

  constructor(
    callId: string,
    userId: string,
    otherUserId: string,
    callbacks: P2PCallbacks
  ) {
    this.callId = callId;
    this.userId = userId;
    this.otherUserId = otherUserId;
    this.callbacks = callbacks;
    
    console.log('[P2P] Manager initialized:', { 
      callId: callId.slice(0, 8), 
      userId: userId.slice(0, 8), 
      otherUserId: otherUserId.slice(0, 8) 
    });
  }

  /**
   * Fetch dynamic TURN credentials from edge function
   */
  private async fetchIceServers(): Promise<RTCIceServer[]> {
    try {
      console.log('[P2P] Fetching ICE servers from edge function...');
      
      const { data, error } = await supabase.functions.invoke('get-turn-credentials');
      
      if (error) {
        console.warn('[P2P] Failed to fetch ICE servers:', error);
        return WebRTCP2PManager.DEFAULT_ICE_SERVERS;
      }
      
      if (data?.iceServers && Array.isArray(data.iceServers)) {
        console.log('[P2P] Got', data.iceServers.length, 'ICE servers from edge function');
        return data.iceServers;
      }
      
      return WebRTCP2PManager.DEFAULT_ICE_SERVERS;
    } catch (error) {
      console.error('[P2P] Error fetching ICE servers:', error);
      return WebRTCP2PManager.DEFAULT_ICE_SERVERS;
    }
  }

  /**
   * Initialize as the CALLER - waits for receiver ready signal, then sends offer
   */
  async initializeAsCaller(isVideo: boolean): Promise<MediaStream> {
    console.log('[P2P] === INITIALIZING AS CALLER ===');
    this.isCaller = true;
    this.callbacks.onStatusChange('ringing', 'Waiting for answer...');
    
    // Fetch dynamic ICE servers
    this.iceServers = await this.fetchIceServers();
    
    // Clean up any old signals first
    await this.cleanupOldSignals();
    
    await this.setupPeerConnection();
    await this.getLocalMedia(isVideo);
    await this.setupSignaling();
    
    // Start polling for signals FIRST
    this.startSignalPolling();
    
    // Create offer
    console.log('[P2P] Creating offer...');
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    
    await this.pc!.setLocalDescription(offer);
    this.pendingOffer = offer;
    console.log('[P2P] Offer created, waiting for receiver ready signal...');
    
    // Send offer after a short delay (receiver may already be on call page)
    setTimeout(async () => {
      if (!this.isConnected && this.pendingOffer) {
        console.log('[P2P] Sending offer (timeout fallback)');
        await this.sendOfferNow();
      }
    }, 1000);
    
    return this.localStream!;
  }

  private async sendOfferNow(): Promise<void> {
    if (!this.pendingOffer || !this.pc?.localDescription) return;
    
    console.log('[P2P] Sending offer to receiver...');
    await this.sendSignal({
      type: 'offer',
      sdp: this.pc.localDescription.sdp,
    });
    this.pendingOffer = null;
  }

  /**
   * Initialize as the RECEIVER - sends ready signal, receives offer, sends answer
   */
  async initializeAsReceiver(isVideo: boolean): Promise<MediaStream> {
    console.log('[P2P] === INITIALIZING AS RECEIVER ===');
    this.isCaller = false;
    this.callbacks.onStatusChange('connecting', 'Connecting...');
    
    // Fetch dynamic ICE servers
    this.iceServers = await this.fetchIceServers();
    
    await this.setupPeerConnection();
    await this.getLocalMedia(isVideo);
    await this.setupSignaling();
    
    // Start polling for signals
    this.startSignalPolling();
    
    // Tell caller we're ready
    console.log('[P2P] Sending ready signal to caller...');
    await this.sendSignal({ type: 'ready' });
    
    // Check for existing offer after a brief delay
    setTimeout(() => this.checkForNewSignals(), 500);
    
    return this.localStream!;
  }

  private async cleanupOldSignals(): Promise<void> {
    try {
      const { error } = await supabase
        .from('call_signals')
        .delete()
        .eq('call_id', this.callId);
      
      if (!error) {
        console.log('[P2P] Cleaned up old signals');
      }
    } catch (error) {
      console.log('[P2P] Could not cleanup old signals:', error);
    }
  }

  private async setupPeerConnection(): Promise<void> {
    console.log('[P2P] Setting up peer connection with', this.iceServers.length, 'ICE servers');
    
    this.pc = new RTCPeerConnection({
      iceServers: this.iceServers.length > 0 ? this.iceServers : WebRTCP2PManager.DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Handle ICE candidates
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('[P2P] ICE candidate:', event.candidate.type, event.candidate.protocol);
        await this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      } else {
        console.log('[P2P] ICE gathering complete');
      }
    };

    // Handle ICE gathering state
    this.pc.onicegatheringstatechange = () => {
      console.log('[P2P] ICE gathering state:', this.pc?.iceGatheringState);
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log('[P2P] Connection state:', state);
      
      switch (state) {
        case 'connecting':
          this.callbacks.onStatusChange('connecting', 'Establishing connection...');
          break;
        case 'connected':
          this.handleConnected();
          break;
        case 'disconnected':
          if (this.isConnected) {
            console.log('[P2P] Connection lost, attempting to reconnect...');
            this.callbacks.onStatusChange('connecting', 'Reconnecting...');
            // Give it a moment to recover before attempting ICE restart
            setTimeout(() => {
              if (this.pc?.connectionState === 'disconnected') {
                this.attemptIceRestart();
              }
            }, 3000);
          }
          break;
        case 'failed':
          console.error('[P2P] Connection failed');
          if (this.initRetryCount < this.maxRetries) {
            this.initRetryCount++;
            console.log('[P2P] Retrying ICE connection, attempt', this.initRetryCount);
            this.attemptIceRestart();
          } else {
            this.callbacks.onStatusChange('failed', 'Connection failed. Please try again.');
          }
          break;
      }
    };

    // Handle ICE connection state
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc?.iceConnectionState;
      console.log('[P2P] ICE state:', iceState);
      
      if (iceState === 'connected' || iceState === 'completed') {
        this.handleConnected();
      } else if (iceState === 'failed') {
        console.log('[P2P] ICE failed, attempting restart...');
        this.attemptIceRestart();
      } else if (iceState === 'disconnected') {
        console.log('[P2P] ICE disconnected, waiting for reconnection...');
      }
    };

    // Handle incoming tracks - THIS IS KEY FOR AUDIO/VIDEO
    this.pc.ontrack = (event) => {
      console.log('[P2P] 🎵 Received remote track:', event.track.kind, 'readyState:', event.track.readyState);
      
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log('[P2P] Using stream from event');
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        console.log('[P2P] Added track to new stream');
      }
      
      // Monitor track state
      event.track.onmute = () => {
        console.log('[P2P] Remote track muted:', event.track.kind);
      };
      event.track.onunmute = () => {
        console.log('[P2P] Remote track unmuted:', event.track.kind);
      };
      event.track.onended = () => {
        console.log('[P2P] Remote track ended:', event.track.kind);
      };
      
      this.callbacks.onRemoteStream(this.remoteStream);
      
      // If we got a track, consider ourselves connected
      if (!this.isConnected) {
        this.handleConnected();
      }
    };

    // Handle negotiation needed (for track changes)
    this.pc.onnegotiationneeded = async () => {
      console.log('[P2P] Negotiation needed');
      // Only re-negotiate if we're already connected and are the caller
      if (this.isConnected && this.isCaller) {
        try {
          const offer = await this.pc!.createOffer();
          await this.pc!.setLocalDescription(offer);
          await this.sendSignal({ type: 'offer', sdp: this.pc!.localDescription?.sdp });
          console.log('[P2P] Renegotiation offer sent');
        } catch (err) {
          console.error('[P2P] Renegotiation error:', err);
        }
      }
    };

    this.startConnectionMonitoring();
  }

  private handleConnected(): void {
    if (!this.isConnected) {
      this.isConnected = true;
      console.log('[P2P] ✅ CALL CONNECTED!');
      this.callbacks.onStatusChange('connected', 'Connected');
      this.stopSignalPolling();
    }
  }

  private async getLocalMedia(isVideo: boolean): Promise<void> {
    try {
      console.log('[P2P] Requesting media access, video:', isVideo);
      
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 },
        } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('[P2P] Got local media:', this.localStream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));

      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        console.log('[P2P] Adding track to PC:', track.kind);
        this.pc!.addTrack(track, this.localStream!);
      });

      this.callbacks.onLocalStream(this.localStream);
    } catch (error: any) {
      console.error('[P2P] Failed to get media:', error);
      throw new Error('Failed to access camera/microphone: ' + error.message);
    }
  }

  private async setupSignaling(): Promise<void> {
    console.log('[P2P] Setting up realtime signaling for call:', this.callId.slice(0, 8));
    
    // Use a unique channel name for this user's perspective
    const channelName = `call-${this.callId}-${this.userId.slice(0, 8)}`;
    
    this.signalChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `to_user_id=eq.${this.userId}`,
        },
        async (payload: any) => {
          const signal = payload.new;
          if (signal.call_id !== this.callId) return;
          if (this.processedSignalIds.has(signal.id)) return;
          this.processedSignalIds.add(signal.id);
          
          console.log('[P2P] Realtime signal received:', signal.signal_data?.type);
          await this.handleSignal(signal.signal_data);
        }
      )
      .subscribe((status) => {
        console.log('[P2P] Realtime channel status:', status);
      });
  }

  private startSignalPolling(): void {
    if (this.pollingInterval) return;
    
    console.log('[P2P] Starting signal polling (300ms interval)');
    
    // Immediately check for signals
    this.checkForNewSignals();
    
    this.pollingInterval = setInterval(async () => {
      if (this.isConnected) {
        this.stopSignalPolling();
        return;
      }
      await this.checkForNewSignals();
    }, 300);
  }

  private stopSignalPolling(): void {
    if (this.pollingInterval) {
      console.log('[P2P] Stopping signal polling');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async checkForNewSignals(): Promise<void> {
    if (this.isConnected) return;

    try {
      const { data, error } = await supabase
        .from('call_signals')
        .select('*')
        .eq('call_id', this.callId)
        .eq('to_user_id', this.userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[P2P] Signal poll error:', error);
        return;
      }

      for (const signal of data || []) {
        if (this.processedSignalIds.has(signal.id)) continue;
        this.processedSignalIds.add(signal.id);
        
        const signalData = signal.signal_data as unknown as SignalData;
        console.log('[P2P] Processing signal from poll:', signalData?.type);
        await this.handleSignal(signalData);
      }
    } catch (error) {
      console.error('[P2P] Poll error:', error);
    }
  }

  private async handleSignal(data: SignalData): Promise<void> {
    if (!this.pc || !data) {
      console.warn('[P2P] Cannot handle signal - PC not ready or no data');
      return;
    }

    try {
      console.log('[P2P] Handling signal:', data.type, 'PC state:', this.pc.signalingState);
      
      switch (data.type) {
        case 'ready':
          // Receiver is ready - send the offer now
          if (this.isCaller && this.pendingOffer) {
            console.log('[P2P] Receiver ready, sending offer immediately');
            this.receiverReady = true;
            await this.sendOfferNow();
          }
          break;

        case 'offer':
          console.log('[P2P] Received offer, signaling state:', this.pc.signalingState);
          
          // Only process if we're in stable state
          if (this.pc.signalingState !== 'stable') {
            console.warn('[P2P] Not in stable state, cannot process offer');
            return;
          }
          
          await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: data.sdp,
          }));
          this.hasRemoteDescription = true;
          console.log('[P2P] Remote description set (offer)');
          
          // Process any pending ICE candidates
          await this.processPendingCandidates();
          
          // Create and send answer
          console.log('[P2P] Creating answer...');
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          console.log('[P2P] Local description set (answer)');
          
          // Send answer to caller
          await this.sendSignal({
            type: 'answer',
            sdp: this.pc.localDescription?.sdp,
          });
          console.log('[P2P] ✅ Answer sent to caller');
          
          this.callbacks.onStatusChange('connecting', 'Finalizing connection...');
          break;

        case 'answer':
          console.log('[P2P] Received answer, signaling state:', this.pc.signalingState);
          
          // Only process if we're waiting for an answer
          if (this.pc.signalingState !== 'have-local-offer') {
            console.warn('[P2P] Not expecting answer, ignoring');
            return;
          }
          
          await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdp,
          }));
          this.hasRemoteDescription = true;
          console.log('[P2P] ✅ Remote description set (answer)');
          
          // Process any pending ICE candidates
          await this.processPendingCandidates();
          
          this.callbacks.onStatusChange('connecting', 'Finalizing...');
          break;

        case 'ice-candidate':
          if (data.candidate) {
            if (this.hasRemoteDescription) {
              try {
                await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('[P2P] ICE candidate added');
              } catch (e) {
                console.warn('[P2P] ICE candidate add error:', e);
              }
            } else {
              console.log('[P2P] Queuing ICE candidate (no remote description yet)');
              this.pendingCandidates.push(data.candidate);
            }
          }
          break;
      }
    } catch (error: any) {
      console.error('[P2P] Signal handling error:', error);
      this.callbacks.onError(error);
    }
  }

  private async processPendingCandidates(): Promise<void> {
    if (this.pendingCandidates.length === 0) return;
    
    console.log('[P2P] Processing', this.pendingCandidates.length, 'pending ICE candidates');
    
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    
    for (const candidate of candidates) {
      try {
        await this.pc!.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[P2P] Failed to add pending candidate:', e);
      }
    }
  }

  private async sendSignal(data: SignalData): Promise<void> {
    console.log('[P2P] Sending signal:', data.type, 'to:', this.otherUserId.slice(0, 8));
    
    const { error } = await supabase
      .from('call_signals')
      .insert({
        call_id: this.callId,
        from_user_id: this.userId,
        to_user_id: this.otherUserId,
        signal_data: data as unknown as Record<string, unknown>,
      } as any);

    if (error) {
      console.error('[P2P] Send signal error:', error);
    } else {
      console.log('[P2P] Signal sent successfully');
    }
  }

  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(async () => {
      if (!this.pc) return;
      
      const connState = this.pc.connectionState;
      const iceState = this.pc.iceConnectionState;
      
      // Log stats if connected
      if (this.isConnected) {
        try {
          const stats = await this.pc.getStats();
          let hasActiveConnection = false;
          let bytesReceived = 0;
          let packetLoss = 0;
          let roundTripTime = 0;
          
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              hasActiveConnection = true;
              roundTripTime = report.currentRoundTripTime || 0;
            }
            if (report.type === 'inbound-rtp') {
              bytesReceived += report.bytesReceived || 0;
              if (report.packetsLost && report.packetsReceived) {
                packetLoss = report.packetsLost / (report.packetsLost + report.packetsReceived) * 100;
              }
            }
          });
          
          if (!hasActiveConnection && this.isConnected) {
            console.log('[P2P] No active connection found, may need reconnection');
          }
          
          // Log network quality periodically
          if (roundTripTime > 0.3) {
            console.log('[P2P] High latency detected:', Math.round(roundTripTime * 1000), 'ms');
          }
          if (packetLoss > 5) {
            console.log('[P2P] Packet loss detected:', packetLoss.toFixed(1), '%');
          }
        } catch (err) {
          // Stats may not be available
        }
      } else {
        console.log('[P2P] Connection monitor:', connState, 'ICE:', iceState);
      }
    }, 5000);
  }

  private stopConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  private async attemptIceRestart(): Promise<void> {
    if (!this.pc || this.isConnected) return;
    
    try {
      console.log('[P2P] Attempting ICE restart...');
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      await this.sendSignal({ type: 'offer', sdp: this.pc.localDescription?.sdp });
      console.log('[P2P] ICE restart offer sent');
    } catch (error) {
      console.error('[P2P] ICE restart failed:', error);
    }
  }

  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      console.log('[P2P] Audio mute toggled:', !track.enabled);
      return track.enabled;
    }
    return true;
  }

  toggleVideo(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      console.log('[P2P] Video toggled:', track.enabled);
      return track.enabled;
    }
    return true;
  }

  async flipCamera(): Promise<boolean> {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return false;

    const settings = videoTrack.getSettings();
    const newFacing = settings.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
      });
      const newTrack = newStream.getVideoTracks()[0];
      
      const sender = this.pc?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);

      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newTrack);
      this.callbacks.onLocalStream(this.localStream);
      console.log('[P2P] Camera flipped to:', newFacing);
      return true;
    } catch (error) {
      console.error('[P2P] Flip camera error:', error);
      return false;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  async cleanup(): Promise<void> {
    console.log('[P2P] Cleaning up...');
    
    this.stopConnectionMonitoring();
    this.stopSignalPolling();

    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    this.localStream?.getTracks().forEach(t => {
      t.stop();
      console.log('[P2P] Stopped local track:', t.kind);
    });
    this.localStream = null;

    this.remoteStream?.getTracks().forEach(t => {
      t.stop();
      console.log('[P2P] Stopped remote track:', t.kind);
    });
    this.remoteStream = null;

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Cleanup signals from database
    try {
      await supabase.from('call_signals').delete().eq('call_id', this.callId);
      console.log('[P2P] Signals cleaned up from database');
    } catch (e) {
      console.warn('[P2P] Could not cleanup signals:', e);
    }

    this.isConnected = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.processedSignalIds.clear();
    this.initRetryCount = 0;
    
    console.log('[P2P] Cleanup complete');
  }
}
