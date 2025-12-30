/**
 * WhatsApp-Style P2P WebRTC Call Manager
 * Uses Supabase Realtime for signaling (SDP offer/answer + ICE candidates)
 * Works on 3G/4G/5G networks with STUN/TURN servers
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

  // STUN + TURN servers for reliable NAT traversal
  // TURN servers are essential for calls through firewalls
  private static readonly ICE_SERVERS: RTCIceServer[] = [
    // STUN servers (free, for simple NAT)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    
    // TURN servers (for symmetric NAT / firewalls)
    // Using metered.ca free tier - more reliable than openrelay
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65c92f6d9f6e5f9ef455',
      credential: 'uJE/KGrh5vKVE7ey',
    },
    {
      urls: 'turn:a.relay.metered.ca:80?transport=tcp',
      username: 'e8dd65c92f6d9f6e5f9ef455',
      credential: 'uJE/KGrh5vKVE7ey',
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
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
    
    console.log('[P2P] Initialized:', { callId, usrId: userId.slice(0, 8), otherUserId: otherUserId.slice(0, 8) });
  }

  /**
   * Initialize as the CALLER - waits for receiver ready signal, then sends offer
   */
  async initializeAsCaller(isVideo: boolean): Promise<MediaStream> {
    console.log('[P2P] === CALLER MODE ===');
    this.isCaller = true;
    this.callbacks.onStatusChange('ringing', 'Waiting for answer...');
    
    // Clean up any old signals first
    await this.cleanupOldSignals();
    
    await this.setupPeerConnection();
    await this.getLocalMedia(isVideo);
    await this.setupSignaling();
    
    // Start polling for signals
    this.startSignalPolling();
    
    // Create offer now but wait for receiver ready signal before sending
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    
    await this.pc!.setLocalDescription(offer);
    this.pendingOffer = offer;
    console.log('[P2P] Offer created, waiting for receiver ready signal...');
    
    // Also send offer after a short delay in case receiver is already ready
    setTimeout(async () => {
      if (!this.isConnected && this.pendingOffer) {
        console.log('[P2P] Sending offer after timeout (receiver may be ready)');
        await this.sendOfferNow();
      }
    }, 1500);
    
    return this.localStream!;
  }

  private async sendOfferNow(): Promise<void> {
    if (!this.pendingOffer || !this.pc?.localDescription) return;
    
    console.log('[P2P] Sending offer to receiver');
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
    console.log('[P2P] === RECEIVER MODE ===');
    this.isCaller = false;
    this.callbacks.onStatusChange('connecting', 'Connecting...');
    
    await this.setupPeerConnection();
    await this.getLocalMedia(isVideo);
    await this.setupSignaling();
    
    // Start polling for signals
    this.startSignalPolling();
    
    // Tell caller we're ready
    console.log('[P2P] Sending ready signal to caller');
    await this.sendSignal({ type: 'ready' });
    
    // Check for existing offer
    await this.checkForExistingOffer();
    
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
    console.log('[P2P] Setting up peer connection with', WebRTCP2PManager.ICE_SERVERS.length, 'ICE servers');
    
    this.pc = new RTCPeerConnection({
      iceServers: WebRTCP2PManager.ICE_SERVERS,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    });

    // Handle ICE candidates
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('[P2P] ICE candidate:', event.candidate.type, event.candidate.protocol);
        await this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
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
            this.callbacks.onStatusChange('connecting', 'Reconnecting...');
          }
          break;
        case 'failed':
          this.callbacks.onStatusChange('failed', 'Connection failed');
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
        console.log('[P2P] ICE failed, attempting restart');
        this.attemptIceRestart();
      }
    };

    // Handle incoming tracks - THIS IS KEY FOR AUDIO/VIDEO
    this.pc.ontrack = (event) => {
      console.log('[P2P] 🎵 Received remote track:', event.track.kind);
      
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }
      
      this.callbacks.onRemoteStream(this.remoteStream);
      this.handleConnected();
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
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
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
      });

      console.log('[P2P] Got local media:', this.localStream.getTracks().map(t => t.kind).join(', '));

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
    
    this.signalChannel = supabase
      .channel(`call-${this.callId}-${this.userId.slice(0, 8)}`)
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
          
          console.log('[P2P] Realtime signal:', signal.signal_data?.type);
          await this.handleSignal(signal.signal_data);
        }
      )
      .subscribe((status) => {
        console.log('[P2P] Realtime channel:', status);
      });
  }

  private startSignalPolling(): void {
    if (this.pollingInterval) return;
    
    console.log('[P2P] Starting signal polling');
    
    this.pollingInterval = setInterval(async () => {
      if (this.isConnected) {
        this.stopSignalPolling();
        return;
      }
      await this.checkForNewSignals();
    }, 500);
    
    this.checkForNewSignals();
  }

  private stopSignalPolling(): void {
    if (this.pollingInterval) {
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

      if (error) return;

      for (const signal of data || []) {
        if (this.processedSignalIds.has(signal.id)) continue;
        this.processedSignalIds.add(signal.id);
        
        const signalData = signal.signal_data as unknown as SignalData;
        console.log('[P2P] Poll found signal:', signalData?.type);
        await this.handleSignal(signalData);
      }
    } catch (error) {
      console.error('[P2P] Poll error:', error);
    }
  }

  private async checkForExistingOffer(): Promise<void> {
    console.log('[P2P] Checking for existing offer...');
    await new Promise(resolve => setTimeout(resolve, 300));
    await this.checkForNewSignals();
  }

  private async handleSignal(data: SignalData): Promise<void> {
    if (!this.pc || !data) return;

    try {
      switch (data.type) {
        case 'ready':
          // Receiver is ready - send the offer now
          if (this.isCaller && this.pendingOffer) {
            console.log('[P2P] Receiver ready, sending offer');
            await this.sendOfferNow();
          }
          break;

        case 'offer':
          console.log('[P2P] Processing offer, state:', this.pc.signalingState);
          
          if (this.pc.signalingState !== 'stable') {
            console.log('[P2P] Not stable, ignoring offer');
            return;
          }
          
          await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: data.sdp,
          }));
          this.hasRemoteDescription = true;
          console.log('[P2P] Remote description set (offer)');
          
          await this.processPendingCandidates();
          
          // Create answer
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          console.log('[P2P] Answer created');
          
          // Send answer
          await this.sendSignal({
            type: 'answer',
            sdp: this.pc.localDescription?.sdp,
          });
          console.log('[P2P] Answer sent');
          
          this.callbacks.onStatusChange('connecting', 'Connecting...');
          break;

        case 'answer':
          console.log('[P2P] Processing answer, state:', this.pc.signalingState);
          
          if (this.pc.signalingState !== 'have-local-offer') {
            console.log('[P2P] Not expecting answer');
            return;
          }
          
          await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdp,
          }));
          this.hasRemoteDescription = true;
          console.log('[P2P] Remote description set (answer)');
          
          await this.processPendingCandidates();
          this.callbacks.onStatusChange('connecting', 'Finalizing...');
          break;

        case 'ice-candidate':
          if (data.candidate) {
            if (this.hasRemoteDescription) {
              try {
                await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (e) {
                console.log('[P2P] ICE add error:', e);
              }
            } else {
              this.pendingCandidates.push(data.candidate);
            }
          }
          break;
      }
    } catch (error: any) {
      console.error('[P2P] Signal handling error:', error);
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
        // Ignore
      }
    }
  }

  private async sendSignal(data: SignalData): Promise<void> {
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
    }
  }

  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(() => {
      if (!this.pc) return;
      console.log('[P2P] Status:', this.pc.connectionState, 'ICE:', this.pc.iceConnectionState);
    }, 15000);
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
      console.log('[P2P] ICE restart');
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      await this.sendSignal({ type: 'offer', sdp: this.pc.localDescription?.sdp });
    } catch (error) {
      console.error('[P2P] ICE restart failed:', error);
    }
  }

  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return true;
  }

  toggleVideo(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
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
    console.log('[P2P] Cleanup');
    
    this.stopConnectionMonitoring();
    this.stopSignalPolling();

    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;

    this.remoteStream?.getTracks().forEach(t => t.stop());
    this.remoteStream = null;

    this.pc?.close();
    this.pc = null;

    // Cleanup signals
    try {
      await supabase.from('call_signals').delete().eq('call_id', this.callId);
    } catch {}

    this.isConnected = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.processedSignalIds.clear();
  }
}
