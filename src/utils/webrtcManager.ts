import { supabase } from '@/integrations/supabase/client';

export type ConnectionStatus = 
  | 'initializing' 
  | 'getting_media' 
  | 'waiting_for_peer'
  | 'signaling' 
  | 'negotiating' 
  | 'ice_checking' 
  | 'connected' 
  | 'reconnecting'
  | 'failed';

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onDetailedStatusChange?: (status: ConnectionStatus, message: string) => void;
  onNetworkQuality?: (quality: NetworkQuality) => void;
  onError: (error: Error) => void;
}

export interface NetworkQuality {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  bitrate: number;
  packetLoss: number;
  latency: number;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private callId: string;
  private userId: string;
  private otherUserId: string;
  private callbacks: WebRTCCallbacks;
  private signalChannel: ReturnType<typeof supabase.channel> | null = null;
  private iceCandidatesQueue: RTCIceCandidate[] = [];
  private isNegotiating = false;
  private hasReceivedOffer = false;
  private hasReceivedAnswer = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private offerRetryTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private offerRetryCount = 0;
  private maxOfferRetries = 5;
  private isChannelSubscribed = false;
  private peerPresent = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private isVideoCall = false;

  private rtcConfig: RTCConfiguration = {
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

  private updateStatus(status: ConnectionStatus, message: string) {
    console.log(`[WebRTC] Status: ${status} - ${message}`);
    this.callbacks.onDetailedStatusChange?.(status, message);
  }

  async initialize(isVideo: boolean): Promise<MediaStream> {
    try {
      this.isVideoCall = isVideo;
      this.updateStatus('initializing', 'Starting WebRTC connection...');
      
      // Fetch TURN credentials first
      await this.fetchTurnCredentials();
      
      this.updateStatus('getting_media', 'Accessing camera and microphone...');
      
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: this.currentFacingMode,
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

      this.updateStatus('signaling', 'Setting up signaling channel...');
      
      // Set up signaling channel using Supabase Realtime with PRESENCE
      await this.setupSignalingWithPresence();

      // Start heartbeat
      this.startHeartbeat();

      // Set connection timeout
      this.setConnectionTimeout();

      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Error initializing:', error);
      this.updateStatus('failed', `Initialization failed: ${(error as Error).message}`);
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  private async fetchTurnCredentials(): Promise<void> {
    try {
      console.log('[WebRTC] Fetching TURN credentials...');
      
      const { data, error } = await supabase.functions.invoke('get-turn-credentials');
      
      if (error) {
        console.warn('[WebRTC] Failed to get TURN credentials, using STUN only:', error);
        return;
      }

      if (data?.iceServers && Array.isArray(data.iceServers)) {
        // Replace ICE servers with new ones (they already include STUN)
        this.rtcConfig.iceServers = data.iceServers;
        console.log('[WebRTC] TURN credentials loaded, ICE servers:', this.rtcConfig.iceServers.length);
      }
    } catch (error) {
      console.warn('[WebRTC] Error fetching TURN credentials:', error);
    }
  }

  private setConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    // 60-second timeout for initial connection
    this.connectionTimeout = setTimeout(() => {
      if (this.peerConnection?.connectionState !== 'connected' && 
          this.peerConnection?.iceConnectionState !== 'connected' &&
          this.peerConnection?.iceConnectionState !== 'completed') {
        console.error('[WebRTC] Initial connection timeout');
        this.updateStatus('failed', 'Connection timeout. Please check your network and try again.');
        this.callbacks.onError(new Error('Connection timeout. Please check your network and try again.'));
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
        
        // Start monitoring network quality
        this.startNetworkQualityMonitoring();
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state:', state);
      
      if (state === 'connected') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.reconnectAttempts = 0;
        this.updateStatus('connected', 'Call connected successfully');
      } else if (state === 'connecting') {
        this.updateStatus('negotiating', 'Establishing peer connection...');
      } else if (state === 'disconnected') {
        this.updateStatus('reconnecting', 'Connection lost, attempting to reconnect...');
        this.attemptIceRestart();
      } else if (state === 'failed') {
        this.updateStatus('failed', 'Connection failed');
        this.attemptIceRestart();
      }
      
      if (state) {
        this.callbacks.onConnectionStateChange(state);
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[WebRTC] ICE connection state:', state);
      
      if (state === 'checking') {
        this.updateStatus('ice_checking', 'Checking network connectivity...');
      } else if (state === 'connected' || state === 'completed') {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.updateStatus('connected', 'ICE connection established');
      } else if (state === 'disconnected') {
        this.updateStatus('reconnecting', 'ICE connection lost, reconnecting...');
      } else if (state === 'failed') {
        this.updateStatus('failed', 'ICE connection failed');
        this.attemptIceRestart();
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

  private async attemptIceRestart() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebRTC] Max reconnection attempts reached');
      this.callbacks.onError(new Error('Failed to reconnect after multiple attempts'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WebRTC] Attempting ICE restart (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
        const offer = await this.peerConnection.createOffer({ iceRestart: true });
        await this.peerConnection.setLocalDescription(offer);
        
        await this.sendSignal({
          type: 'offer',
          sdp: { type: offer.type, sdp: offer.sdp },
          from: this.userId,
          iceRestart: true,
        });
      }
    } catch (error) {
      console.error('[WebRTC] ICE restart failed:', error);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (this.isChannelSubscribed) {
        await this.sendSignal({
          type: 'heartbeat',
          from: this.userId,
          timestamp: Date.now(),
        });
      }
    }, 5000);
  }

  private startNetworkQualityMonitoring() {
    if (this.statsInterval) return;
    
    let lastBytesReceived = 0;
    let lastTimestamp = Date.now();
    
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;
      
      try {
        const stats = await this.peerConnection.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;
        let roundTripTime = 0;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
            bytesReceived = report.bytesReceived || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            roundTripTime = report.currentRoundTripTime * 1000 || 0; // Convert to ms
          }
        });
        
        const now = Date.now();
        const timeDiff = (now - lastTimestamp) / 1000;
        const bitrate = Math.round(((bytesReceived - lastBytesReceived) * 8) / timeDiff / 1000); // kbps
        lastBytesReceived = bytesReceived;
        lastTimestamp = now;
        
        const totalPackets = packetsReceived + packetsLost;
        const packetLoss = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;
        
        let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
        if (packetLoss > 5 || roundTripTime > 300) {
          quality = 'poor';
        } else if (packetLoss > 2 || roundTripTime > 200) {
          quality = 'fair';
        } else if (packetLoss > 0.5 || roundTripTime > 100) {
          quality = 'good';
        }
        
        this.callbacks.onNetworkQuality?.({
          quality,
          bitrate,
          packetLoss: Math.round(packetLoss * 100) / 100,
          latency: Math.round(roundTripTime),
        });
      } catch (error) {
        console.warn('[WebRTC] Error getting stats:', error);
      }
    }, 2000);
  }

  // Use consistent channel name and Supabase Presence for peer detection
  private async setupSignalingWithPresence(): Promise<void> {
    console.log('[WebRTC] Setting up Realtime signaling with Presence for call:', this.callId);
    
    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }
    
    // CRITICAL FIX: Use consistent channel name WITHOUT timestamp
    const channelName = `call-signal:${this.callId}`;
    console.log('[WebRTC] Using channel:', channelName);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (!this.isChannelSubscribed) {
          console.error('[WebRTC] Signaling channel subscription timeout');
          reject(new Error('Signaling channel subscription timeout'));
        }
      }, 15000);

      this.signalChannel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
            presence: { key: this.userId },
          }
        })
        // Handle presence for peer detection
        .on('presence', { event: 'sync' }, () => {
          const state = this.signalChannel?.presenceState() || {};
          const presentUsers = Object.keys(state);
          console.log('[WebRTC] Presence sync, users:', presentUsers);
          
          // Check if other user is present
          const otherPresent = presentUsers.includes(this.otherUserId);
          if (otherPresent && !this.peerPresent) {
            this.peerPresent = true;
            console.log('[WebRTC] Peer is now present!');
          }
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          console.log('[WebRTC] User joined:', key);
          if (key === this.otherUserId) {
            this.peerPresent = true;
            console.log('[WebRTC] Peer joined the channel!');
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log('[WebRTC] User left:', key);
          if (key === this.otherUserId) {
            this.peerPresent = false;
          }
        })
        // Handle broadcast signals
        .on('broadcast', { event: 'signal' }, async (payload) => {
          const signal = payload.payload;
          if (signal.from !== this.userId) {
            console.log('[WebRTC] Received signal:', signal.type);
            
            if (signal.type === 'heartbeat') {
              this.lastHeartbeat = signal.timestamp;
              return;
            }
            
            await this.handleSignal(signal);
          }
        })
        .subscribe(async (status) => {
          console.log('[WebRTC] Signal channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeoutId);
            this.isChannelSubscribed = true;
            
            // Track our presence
            await this.signalChannel?.track({
              online_at: new Date().toISOString(),
              user_id: this.userId,
            });
            
            console.log('[WebRTC] Ready to exchange signals, tracking presence');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            clearTimeout(timeoutId);
            this.isChannelSubscribed = false;
            reject(new Error('Signaling channel error'));
          } else if (status === 'TIMED_OUT') {
            clearTimeout(timeoutId);
            this.isChannelSubscribed = false;
            reject(new Error('Signaling channel timeout'));
          }
        });
    });
  }

  private async sendSignal(data: any) {
    if (!this.signalChannel || !this.isChannelSubscribed) {
      console.error('[WebRTC] No signal channel available');
      return;
    }

    try {
      await this.signalChannel.send({
        type: 'broadcast',
        event: 'signal',
        payload: data,
      });
      if (data.type !== 'heartbeat') {
        console.log('[WebRTC] Signal sent:', data.type);
      }
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
        console.log('[WebRTC] Processing offer', data.iceRestart ? '(ICE restart)' : '');
        
        if (this.peerConnection.signalingState !== 'stable' && !data.iceRestart) {
          console.log('[WebRTC] Ignoring offer - not in stable state');
          return;
        }
        
        this.hasReceivedOffer = true;
        this.updateStatus('negotiating', 'Processing incoming offer...');
        
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
        
        await this.processQueuedCandidates();
        
      } else if (data.type === 'answer') {
        console.log('[WebRTC] Processing answer');
        
        if (this.peerConnection.signalingState !== 'have-local-offer') {
          console.log('[WebRTC] Ignoring answer - not in have-local-offer state');
          return;
        }
        
        if (this.offerRetryTimeout) {
          clearTimeout(this.offerRetryTimeout);
          this.offerRetryTimeout = null;
        }
        this.hasReceivedAnswer = true;
        
        this.updateStatus('ice_checking', 'Answer received, checking connectivity...');
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log('[WebRTC] Remote description set (answer)');
        
        await this.processQueuedCandidates();
        
      } else if (data.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(data.candidate);
        
        if (this.peerConnection.remoteDescription?.type) {
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

  // Wait for peer presence before sending offer
  async waitForPeerAndCreateOffer(timeoutMs: number = 10000): Promise<void> {
    this.updateStatus('waiting_for_peer', 'Waiting for other user to join...');
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.peerPresent) {
        console.log('[WebRTC] Peer detected via presence, creating offer...');
        await this.createAndSendOffer();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('[WebRTC] Peer not detected, creating offer anyway...');
    await this.createAndSendOffer();
  }

  // Receiver signals ready (deprecated, using presence now)
  async sendReceiverReady() {
    console.log('[WebRTC] Receiver is ready (using presence tracking)');
  }

  // Wait for receiver ready (deprecated, using presence now)
  async waitForReceiverReady(timeoutMs: number = 10000): Promise<boolean> {
    return this.waitForPeerPresence(timeoutMs);
  }

  private async waitForPeerPresence(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.peerPresent) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('[WebRTC] Peer presence timeout, proceeding anyway');
    return false;
  }

  async createAndSendOffer() {
    if (!this.peerConnection) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    if (this.hasReceivedOffer) {
      console.log('[WebRTC] Already received offer, not creating one');
      return;
    }
    
    if (this.hasReceivedAnswer) {
      console.log('[WebRTC] Already received answer, not resending offer');
      return;
    }

    if (this.isNegotiating) {
      console.log('[WebRTC] Already negotiating, skipping offer');
      return;
    }

    try {
      this.isNegotiating = true;
      this.updateStatus('negotiating', `Creating offer (attempt ${this.offerRetryCount + 1}/${this.maxOfferRetries})...`);
      console.log('[WebRTC] Creating offer (attempt', this.offerRetryCount + 1, ')...');
      
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
      
      // Retry if no answer received within 3 seconds
      if (this.offerRetryCount < this.maxOfferRetries) {
        this.offerRetryTimeout = setTimeout(() => {
          if (!this.hasReceivedAnswer && this.peerConnection) {
            console.log('[WebRTC] No answer received, retrying offer...');
            this.offerRetryCount++;
            this.isNegotiating = false;
            this.createAndSendOffer();
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      this.updateStatus('failed', 'Failed to create offer');
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

  async flipCamera(): Promise<boolean> {
    if (!this.localStream || !this.isVideoCall) return false;
    
    try {
      // Toggle facing mode
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
      
      // Get new stream with flipped camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: this.currentFacingMode,
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false,
      });
      
      // Get the new video track
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      
      if (newVideoTrack && oldVideoTrack) {
        // Replace track in peer connection
        const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        
        // Replace track in local stream
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
        this.localStream.addTrack(newVideoTrack);
        
        console.log('[WebRTC] Camera flipped to:', this.currentFacingMode);
        return true;
      }
    } catch (error) {
      console.error('[WebRTC] Error flipping camera:', error);
      // Revert facing mode on error
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    }
    
    return false;
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true,
      });
      
      const screenVideoTrack = this.screenStream.getVideoTracks()[0];
      
      // Replace video track in peer connection
      const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
      if (sender && screenVideoTrack) {
        await sender.replaceTrack(screenVideoTrack);
        
        // Handle screen share stop
        screenVideoTrack.onended = async () => {
          await this.stopScreenShare();
        };
      }
      
      console.log('[WebRTC] Screen sharing started');
      return this.screenStream;
    } catch (error) {
      console.error('[WebRTC] Error starting screen share:', error);
      return null;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    // Restore camera video track
    if (this.localStream && this.isVideoCall) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
      }
    }
    
    console.log('[WebRTC] Screen sharing stopped');
  }

  isScreenSharing(): boolean {
    return this.screenStream !== null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected' ||
           this.peerConnection?.iceConnectionState === 'connected' ||
           this.peerConnection?.iceConnectionState === 'completed';
  }

  getConnectionStats(): { reconnectAttempts: number; isChannelSubscribed: boolean; peerPresent: boolean } {
    return {
      reconnectAttempts: this.reconnectAttempts,
      isChannelSubscribed: this.isChannelSubscribed,
      peerPresent: this.peerPresent,
    };
  }

  async cleanup() {
    console.log('[WebRTC] Cleaning up...');
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.offerRetryTimeout) {
      clearTimeout(this.offerRetryTimeout);
      this.offerRetryTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Stop screen share if active
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Stop all local tracks
    this.localStream?.getTracks().forEach(track => track.stop());

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
    this.hasReceivedAnswer = false;
    this.isNegotiating = false;
    this.offerRetryCount = 0;
    this.isChannelSubscribed = false;
    this.peerPresent = false;
    
    console.log('[WebRTC] Cleanup complete');
  }
}
