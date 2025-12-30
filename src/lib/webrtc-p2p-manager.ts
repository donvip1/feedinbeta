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
  type: 'offer' | 'answer' | 'ice-candidate';
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

  // Multiple STUN/TURN servers for better NAT traversal
  private static readonly ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers for NAT traversal (works through firewalls)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
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
    
    console.log('[P2P] Initialized:', { callId, userId, otherUserId });
  }

  /**
   * Initialize as the CALLER - creates offer and waits for answer
   */
  async initializeAsCaller(isVideo: boolean): Promise<MediaStream> {
    console.log('[P2P] Initializing as CALLER, isVideo:', isVideo);
    this.isCaller = true;
    this.callbacks.onStatusChange('ringing', 'Calling...');
    
    // Clean up any old signals for this call first
    await this.cleanupOldSignals();
    
    await this.setupPeerConnection();
    await this.getLocalMedia(isVideo);
    await this.setupSignaling();
    
    // Start polling for answer BEFORE sending offer
    this.startSignalPolling();
    
    // Create and send offer
    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    
    await this.pc!.setLocalDescription(offer);
    console.log('[P2P] Created offer, waiting for ICE candidates...');
    
    // Wait for ICE candidates to gather (with timeout)
    await this.waitForIceGathering();
    
    // Store offer in database for the receiver
    console.log('[P2P] Sending offer to peer');
    await this.sendSignal({
      type: 'offer',
      sdp: this.pc!.localDescription?.sdp,
    });
    
    return this.localStream!;
  }

  /**
   * Initialize as the RECEIVER - receives offer and sends answer
   */
  async initializeAsReceiver(isVideo: boolean): Promise<MediaStream> {
    console.log('[P2P] Initializing as RECEIVER, isVideo:', isVideo);
    this.isCaller = false;
    this.callbacks.onStatusChange('connecting', 'Connecting...');
    
    await this.setupPeerConnection();
    await this.getLocalMedia(isVideo);
    await this.setupSignaling();
    
    // Start polling for signals immediately
    this.startSignalPolling();
    
    // Process any existing offer (may have arrived before we subscribed)
    await this.checkForExistingOffer();
    
    return this.localStream!;
  }

  private async cleanupOldSignals(): Promise<void> {
    try {
      // Delete old signals for this call to start fresh
      await supabase
        .from('call_signals')
        .delete()
        .eq('call_id', this.callId);
      console.log('[P2P] Cleaned up old signals for call:', this.callId);
    } catch (error) {
      console.log('[P2P] Could not cleanup old signals:', error);
    }
  }

  private async setupPeerConnection(): Promise<void> {
    this.pc = new RTCPeerConnection({
      iceServers: WebRTCP2PManager.ICE_SERVERS,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    });

    // Handle ICE candidates - send them immediately
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('[P2P] New ICE candidate:', event.candidate.type, event.candidate.protocol);
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
          this.callbacks.onStatusChange('connecting', 'Reconnecting...');
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

    // Handle ICE gathering state
    this.pc.onicegatheringstatechange = () => {
      console.log('[P2P] ICE gathering state:', this.pc?.iceGatheringState);
    };

    // Handle incoming tracks - THIS IS KEY FOR AUDIO/VIDEO
    this.pc.ontrack = (event) => {
      console.log('[P2P] Received remote track:', event.track.kind, 'streams:', event.streams.length);
      
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

    // Start connection monitoring
    this.startConnectionMonitoring();
  }

  private handleConnected(): void {
    if (!this.isConnected) {
      this.isConnected = true;
      console.log('[P2P] Call connected!');
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

      console.log('[P2P] Got local media, tracks:', this.localStream.getTracks().map(t => t.kind));

      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        console.log('[P2P] Adding local track:', track.kind);
        this.pc!.addTrack(track, this.localStream!);
      });

      this.callbacks.onLocalStream(this.localStream);
    } catch (error: any) {
      console.error('[P2P] Failed to get local media:', error);
      throw new Error('Failed to access camera/microphone: ' + error.message);
    }
  }

  private async setupSignaling(): Promise<void> {
    console.log('[P2P] Setting up signaling channel for call:', this.callId);
    
    // Subscribe to call_signals table for signals TO this user
    this.signalChannel = supabase
      .channel(`call-signals-${this.callId}-${this.userId}`)
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
          
          // Only process signals for THIS call
          if (signal.call_id !== this.callId) return;
          
          // Avoid processing the same signal twice
          if (this.processedSignalIds.has(signal.id)) return;
          this.processedSignalIds.add(signal.id);
          
          console.log('[P2P] Realtime signal received:', signal.signal_data?.type);
          await this.handleSignal(signal.signal_data);
        }
      )
      .subscribe((status) => {
        console.log('[P2P] Signal channel status:', status);
      });
  }

  private startSignalPolling(): void {
    if (this.pollingInterval) return;
    
    console.log('[P2P] Starting signal polling (300ms interval)');
    
    // Poll every 300ms for faster response
    this.pollingInterval = setInterval(async () => {
      await this.checkForNewSignals();
    }, 300);
    
    // Check immediately
    this.checkForNewSignals();
  }

  private stopSignalPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[P2P] Stopped signal polling');
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
        console.error('[P2P] Error polling signals:', error);
        return;
      }

      for (const signal of data || []) {
        if (this.processedSignalIds.has(signal.id)) continue;
        this.processedSignalIds.add(signal.id);
        
        const signalData = signal.signal_data as unknown as SignalData;
        console.log('[P2P] Processing polled signal:', signalData?.type);
        await this.handleSignal(signalData);
      }
    } catch (error) {
      console.error('[P2P] Polling error:', error);
    }
  }

  private async checkForExistingOffer(): Promise<void> {
    console.log('[P2P] Checking for existing offer...');
    
    // Small delay to ensure signals are stored
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const { data, error } = await supabase
      .from('call_signals')
      .select('*')
      .eq('call_id', this.callId)
      .eq('to_user_id', this.userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[P2P] Error checking for offer:', error);
      return;
    }

    console.log('[P2P] Found', data?.length || 0, 'existing signals');

    // Process any existing signals
    for (const signal of data || []) {
      if (this.processedSignalIds.has(signal.id)) continue;
      this.processedSignalIds.add(signal.id);
      
      const signalData = signal.signal_data as unknown as SignalData;
      console.log('[P2P] Processing existing signal:', signalData?.type);
      await this.handleSignal(signalData);
    }
  }

  private async handleSignal(data: SignalData): Promise<void> {
    if (!this.pc || !data) return;

    try {
      switch (data.type) {
        case 'offer':
          console.log('[P2P] Processing offer, current state:', this.pc.signalingState);
          
          if (this.pc.signalingState !== 'stable') {
            console.log('[P2P] Not in stable state, ignoring offer');
            return;
          }
          
          await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: data.sdp,
          }));
          this.hasRemoteDescription = true;
          console.log('[P2P] Set remote description (offer)');
          
          // Process any pending ICE candidates
          await this.processPendingCandidates();
          
          // Create and send answer
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          console.log('[P2P] Created answer, waiting for ICE...');
          
          // Wait briefly for ICE candidates
          await this.waitForIceGathering();
          
          console.log('[P2P] Sending answer to caller');
          await this.sendSignal({
            type: 'answer',
            sdp: this.pc.localDescription?.sdp,
          });
          
          this.callbacks.onStatusChange('connecting', 'Answer sent, connecting...');
          break;

        case 'answer':
          console.log('[P2P] Processing answer, current state:', this.pc.signalingState);
          
          if (this.pc.signalingState !== 'have-local-offer') {
            console.log('[P2P] Not expecting answer, state:', this.pc.signalingState);
            return;
          }
          
          await this.pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdp,
          }));
          this.hasRemoteDescription = true;
          console.log('[P2P] Set remote description (answer)');
          
          // Process any pending ICE candidates
          await this.processPendingCandidates();
          
          this.callbacks.onStatusChange('connecting', 'Establishing connection...');
          break;

        case 'ice-candidate':
          if (data.candidate) {
            if (this.hasRemoteDescription && this.pc.remoteDescription) {
              console.log('[P2P] Adding ICE candidate immediately');
              try {
                await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (e) {
                console.log('[P2P] Error adding ICE candidate:', e);
              }
            } else {
              console.log('[P2P] Queuing ICE candidate (no remote description yet)');
              this.pendingCandidates.push(data.candidate);
            }
          }
          break;
      }
    } catch (error: any) {
      console.error('[P2P] Error handling signal:', error);
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
        console.log('[P2P] Error adding pending candidate:', e);
      }
    }
  }

  private async sendSignal(data: SignalData): Promise<void> {
    console.log('[P2P] Sending signal:', data.type);
    
    const insertData = {
      call_id: this.callId,
      from_user_id: this.userId,
      to_user_id: this.otherUserId,
      signal_data: data as unknown as Record<string, unknown>,
    };
    
    const { error } = await supabase
      .from('call_signals')
      .insert(insertData as any);

    if (error) {
      console.error('[P2P] Error sending signal:', error);
    } else {
      console.log('[P2P] Signal sent successfully:', data.type);
    }
  }

  private async waitForIceGathering(): Promise<void> {
    if (!this.pc) return;
    
    if (this.pc.iceGatheringState === 'complete') {
      console.log('[P2P] ICE gathering already complete');
      return;
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[P2P] ICE gathering timeout (1.5s), proceeding with available candidates');
        resolve();
      }, 1500); // Reduced timeout for faster connection

      const checkComplete = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          console.log('[P2P] ICE gathering complete');
          resolve();
        }
      };

      this.pc!.onicegatheringstatechange = checkComplete;
      checkComplete(); // Check immediately
    });
  }

  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(() => {
      if (!this.pc) {
        this.stopConnectionMonitoring();
        return;
      }

      const state = this.pc.connectionState;
      const iceState = this.pc.iceConnectionState;
      
      console.log('[P2P] Connection check - State:', state, 'ICE:', iceState);
    }, 10000);
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
      console.log('[P2P] Attempting ICE restart');
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      
      await this.sendSignal({
        type: 'offer',
        sdp: this.pc.localDescription?.sdp,
      });
    } catch (error) {
      console.error('[P2P] ICE restart failed:', error);
    }
  }

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('[P2P] Audio muted:', !audioTrack.enabled);
        return audioTrack.enabled;
      }
    }
    return true;
  }

  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('[P2P] Video enabled:', videoTrack.enabled);
        return videoTrack.enabled;
      }
    }
    return true;
  }

  async flipCamera(): Promise<boolean> {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return false;

    const settings = videoTrack.getSettings();
    const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Replace track in peer connection
      const sender = this.pc?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Update local stream
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      
      this.callbacks.onLocalStream(this.localStream);
      console.log('[P2P] Camera flipped to:', newFacingMode);
      return true;
    } catch (error) {
      console.error('[P2P] Failed to flip camera:', error);
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
    console.log('[P2P] Cleaning up call resources');
    
    this.stopConnectionMonitoring();
    this.stopSignalPolling();

    // Unsubscribe from signaling channel
    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[P2P] Stopped local track:', track.kind);
      });
      this.localStream = null;
    }

    // Stop remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
      });
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Clean up signals from database
    try {
      await supabase
        .from('call_signals')
        .delete()
        .eq('call_id', this.callId);
    } catch (error) {
      console.log('[P2P] Could not cleanup signals:', error);
    }

    this.isConnected = false;
    this.hasRemoteDescription = false;
    this.pendingCandidates = [];
    this.processedSignalIds.clear();
    
    console.log('[P2P] Cleanup complete');
  }
}
