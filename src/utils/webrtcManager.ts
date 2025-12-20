import { supabase } from '@/integrations/supabase/client';

export type ConnectionStatus = 
  | 'initializing' 
  | 'getting_media' 
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
  onError: (error: Error) => void;
}

interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
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
  private hasReceivedAnswer = false;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private offerRetryTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private offerRetryCount = 0;
  private maxOfferRetries = 5;
  private channelSubscriptionAttempts = 0;
  private maxChannelSubscriptionAttempts = 3;
  private isChannelSubscribed = false;
  private receiverReadyReceived = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;

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
      this.updateStatus('initializing', 'Starting WebRTC connection...');
      
      // Fetch TURN credentials first
      await this.fetchTurnCredentials();
      
      this.updateStatus('getting_media', 'Accessing camera and microphone...');
      
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

      this.updateStatus('signaling', 'Setting up signaling channel...');
      
      // Set up signaling channel using Supabase Realtime broadcast with retry
      await this.setupSignalingWithRetry();

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
        // Merge TURN servers with existing STUN servers
        this.rtcConfig.iceServers = [
          ...this.rtcConfig.iceServers!,
          ...data.iceServers,
        ];
        console.log('[WebRTC] TURN credentials loaded, ICE servers:', this.rtcConfig.iceServers.length);
      }
    } catch (error) {
      console.warn('[WebRTC] Error fetching TURN credentials:', error);
      // Continue with STUN-only configuration
    }
  }

  private setConnectionTimeout() {
    // Clear any existing timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    // Set a 90-second timeout ONLY for initial connection establishment
    this.connectionTimeout = setTimeout(() => {
      // Only timeout if we never connected at all
      if (this.peerConnection?.connectionState !== 'connected' && 
          this.peerConnection?.iceConnectionState !== 'connected' &&
          this.peerConnection?.iceConnectionState !== 'completed') {
        console.error('[WebRTC] Initial connection timeout - failed to connect within 90 seconds');
        this.updateStatus('failed', 'Connection timeout. Please check your network and try again.');
        this.callbacks.onError(new Error('Connection timeout. Please check your network and try again.'));
      }
    }, 90000);
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

  private async setupSignalingWithRetry(): Promise<void> {
    while (this.channelSubscriptionAttempts < this.maxChannelSubscriptionAttempts) {
      try {
        await this.setupSignaling();
        return;
      } catch (error) {
        this.channelSubscriptionAttempts++;
        console.error(`[WebRTC] Signaling setup failed (attempt ${this.channelSubscriptionAttempts}/${this.maxChannelSubscriptionAttempts}):`, error);
        
        if (this.channelSubscriptionAttempts < this.maxChannelSubscriptionAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, this.channelSubscriptionAttempts - 1) * 1000;
          console.log(`[WebRTC] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error('Failed to setup signaling channel after multiple attempts');
  }

  private async setupSignaling(): Promise<void> {
    console.log('[WebRTC] Setting up Realtime signaling channel for call:', this.callId);
    
    // Clean up any existing channel first
    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }
    
    // Use unique channel name with timestamp to avoid conflicts
    const channelName = `call-signal:${this.callId}:${Date.now()}`;
    
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
        .on('broadcast', { event: 'signal' }, async (payload) => {
          const signal = payload.payload;
          // Only process signals meant for us
          if (signal.from !== this.userId) {
            console.log('[WebRTC] Received signal:', signal.type);
            
            if (signal.type === 'heartbeat') {
              this.lastHeartbeat = signal.timestamp;
              return;
            }
            
            if (signal.type === 'receiver_ready') {
              console.log('[WebRTC] Receiver is ready, can send offer now');
              this.receiverReadyReceived = true;
              return;
            }
            
            await this.handleSignal(signal);
          }
        })
        .subscribe((status) => {
          console.log('[WebRTC] Signal channel status:', status);
          
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeoutId);
            this.isChannelSubscribed = true;
            console.log('[WebRTC] Ready to exchange signals');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            clearTimeout(timeoutId);
            this.isChannelSubscribed = false;
            reject(new Error('Signaling channel error - check RLS policies and network'));
          } else if (status === 'TIMED_OUT') {
            clearTimeout(timeoutId);
            this.isChannelSubscribed = false;
            reject(new Error('Signaling channel connection timed out'));
          } else if (status === 'CLOSED') {
            this.isChannelSubscribed = false;
            console.warn('[WebRTC] Signaling channel was closed');
          }
        });
    });
  }

  private async sendSignal(data: any) {
    if (!this.signalChannel || !this.isChannelSubscribed) {
      console.error('[WebRTC] No signal channel available or not subscribed');
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
        
        // Check if we can accept this offer
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
        
        // Process queued ICE candidates
        await this.processQueuedCandidates();
        
      } else if (data.type === 'answer') {
        console.log('[WebRTC] Processing answer');
        
        if (this.peerConnection.signalingState !== 'have-local-offer') {
          console.log('[WebRTC] Ignoring answer - not in have-local-offer state');
          return;
        }
        
        // Clear offer retry timeout since we got an answer
        if (this.offerRetryTimeout) {
          clearTimeout(this.offerRetryTimeout);
          this.offerRetryTimeout = null;
        }
        this.hasReceivedAnswer = true;
        
        this.updateStatus('ice_checking', 'Answer received, checking connectivity...');
        
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

  // Notify caller that receiver is ready to receive offer
  async sendReceiverReady() {
    console.log('[WebRTC] Sending receiver_ready signal');
    await this.sendSignal({
      type: 'receiver_ready',
      from: this.userId,
    });
  }

  // Wait for receiver to be ready before creating offer
  async waitForReceiverReady(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.receiverReadyReceived) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('[WebRTC] Receiver ready timeout, proceeding with offer anyway');
    return false;
  }

  async createAndSendOffer() {
    if (!this.peerConnection) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    // Don't create offer if we already received one or got an answer
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
      
      // Set up retry if no answer received within 3 seconds
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

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected' ||
           this.peerConnection?.iceConnectionState === 'connected' ||
           this.peerConnection?.iceConnectionState === 'completed';
  }

  getConnectionStats(): { reconnectAttempts: number; isChannelSubscribed: boolean } {
    return {
      reconnectAttempts: this.reconnectAttempts,
      isChannelSubscribed: this.isChannelSubscribed,
    };
  }

  async cleanup() {
    console.log('[WebRTC] Cleaning up...');
    
    // Clear timeouts
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
    this.hasReceivedAnswer = false;
    this.isNegotiating = false;
    this.offerRetryCount = 0;
    this.channelSubscriptionAttempts = 0;
    this.isChannelSubscribed = false;
    this.receiverReadyReceived = false;
    
    console.log('[WebRTC] Cleanup complete');
  }
}
