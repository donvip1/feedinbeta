/**
 * Cloudflare Call Manager
 * 
 * Unified manager for 1-on-1 audio/video calls using Cloudflare SFU.
 * Replaces the old P2P WebRTC manager for better reliability.
 */

import { supabase } from '@/integrations/supabase/client';

export type ConnectionStatus = 
  | 'initializing' 
  | 'getting_media' 
  | 'waiting_for_peer'
  | 'signaling' 
  | 'negotiating' 
  | 'connected' 
  | 'reconnecting'
  | 'failed';

export interface NetworkQuality {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  bitrate: number;
  packetLoss: number;
  latency: number;
}

export interface CallManagerCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDetailedStatusChange?: (status: ConnectionStatus, message: string) => void;
  onNetworkQuality?: (quality: NetworkQuality) => void;
  onError: (error: Error) => void;
}

interface SFUResponse {
  success: boolean;
  sessionId?: string;
  sessionDescription?: RTCSessionDescriptionInit;
  tracks?: any[];
  error?: string;
}

export class CloudflareCallManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private sessionId: string | null = null;
  private localTrackName: string | null = null;
  private callId: string;
  private userId: string;
  private otherUserId: string;
  private callbacks: CallManagerCallbacks;
  private isVideoCall: boolean = false;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private statsInterval: NodeJS.Timeout | null = null;
  private signalChannel: ReturnType<typeof supabase.channel> | null = null;
  private dbSignalChannel: ReturnType<typeof supabase.channel> | null = null;
  private isSubscribedToRemote: boolean = false;
  private peerDiscoveryInterval: NodeJS.Timeout | null = null;
  private trackBroadcastInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private pendingRenegotiation: Promise<void> | null = null;
  private operationQueue: Promise<any> = Promise.resolve();

  constructor(
    callId: string,
    userId: string,
    otherUserId: string,
    callbacks: CallManagerCallbacks
  ) {
    this.callId = callId;
    this.userId = userId;
    this.otherUserId = otherUserId;
    this.callbacks = callbacks;
  }

  private updateStatus(status: ConnectionStatus, message: string) {
    console.log(`[CloudflareCall] Status: ${status} - ${message}`);
    this.callbacks.onDetailedStatusChange?.(status, message);
  }

  /**
   * Serialize SFU operations to prevent signaling state conflicts
   */
  private async enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const currentQueue = this.operationQueue;
    const newOperation = currentQueue.then(() => operation()).catch((e) => {
      console.error('[CloudflareCall] Queued operation failed:', e);
      throw e;
    });
    this.operationQueue = newOperation.catch(() => {});
    return newOperation;
  }

  /**
   * Wait for any pending renegotiation before proceeding
   */
  private async waitForRenegotiation(): Promise<void> {
    if (this.pendingRenegotiation) {
      console.log('[CloudflareCall] Waiting for pending renegotiation...');
      await this.pendingRenegotiation;
    }
  }

  /**
   * Initialize the call - get media and set up SFU connection
   */
  async initialize(isVideo: boolean): Promise<MediaStream> {
    try {
      this.isVideoCall = isVideo;
      this.updateStatus('initializing', 'Starting call connection...');

      // Set connection timeout - if not connected in 45 seconds, fail
      this.connectionTimeout = setTimeout(() => {
        if (!this.isSubscribedToRemote) {
          console.log('[CloudflareCall] Connection timeout - no peer found');
          this.updateStatus('failed', 'Connection timeout - could not find peer');
          this.callbacks.onError(new Error('Connection timeout - could not find peer'));
        }
      }, 45000);

      // Get local media
      this.updateStatus('getting_media', 'Accessing camera and microphone...');
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

      console.log('[CloudflareCall] Got local stream with tracks:', this.localStream.getTracks().map(t => t.kind));

      // Create SFU session
      this.updateStatus('signaling', 'Creating session...');
      const sessionResult = await this.createSession();
      if (!sessionResult.success || !sessionResult.sessionId) {
        throw new Error(sessionResult.error || 'Failed to create session');
      }
      this.sessionId = sessionResult.sessionId;
      console.log('[CloudflareCall] Created session:', this.sessionId.slice(0, 8));

      // Initialize peer connection
      await this.initPeerConnection();

      // Publish our tracks
      this.updateStatus('negotiating', 'Publishing media...');
      await this.publishTracks();

      // Set up BOTH signaling mechanisms for maximum reliability
      this.updateStatus('waiting_for_peer', 'Waiting for peer to connect...');
      await this.setupSignaling();
      this.setupDatabaseSignaling();
      
      // Start polling for peer signals as backup
      this.startPeerDiscoveryPolling();
      
      // Re-broadcast our track info periodically until connected
      this.startTrackBroadcasting();

      // Start network quality monitoring
      this.startNetworkQualityMonitoring();

      return this.localStream;
    } catch (error) {
      console.error('[CloudflareCall] Error initializing:', error);
      this.updateStatus('failed', `Initialization failed: ${(error as Error).message}`);
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  /**
   * Create a new SFU session
   */
  private async createSession(): Promise<SFUResponse> {
    const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
      body: { action: 'create-session' },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data as SFUResponse;
  }

  /**
   * Initialize the peer connection
   */
  private async initPeerConnection(): Promise<void> {
    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      return;
    }

    console.log('[CloudflareCall] Creating peer connection...');

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
    });

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      console.log('[CloudflareCall] ✅ Received remote track:', event.track.kind, 'readyState:', event.track.readyState);
      if (event.streams[0]) {
        console.log('[CloudflareCall] Remote stream has', event.streams[0].getTracks().length, 'tracks');
        this.clearConnectionTimeout();
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[CloudflareCall] Connection state:', state);
      
      if (state === 'connected') {
        this.clearConnectionTimeout();
        this.stopTrackBroadcasting();
        this.stopPeerDiscoveryPolling();
        this.updateStatus('connected', 'Call connected');
      } else if (state === 'failed') {
        this.updateStatus('failed', 'Connection failed');
      } else if (state === 'disconnected') {
        this.updateStatus('reconnecting', 'Reconnecting...');
      }

      if (state) {
        this.callbacks.onConnectionStateChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[CloudflareCall] ICE state:', this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[CloudflareCall] ICE gathering:', this.peerConnection?.iceGatheringState);
    };
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Wait for ICE gathering to complete
   */
  private waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[CloudflareCall] ICE gathering timeout, proceeding...');
        resolve();
      }, timeoutMs);

      const handler = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', handler);
          console.log('[CloudflareCall] ICE gathering complete');
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', handler);
    });
  }

  /**
   * Publish local tracks to SFU - serialized through operation queue
   */
  private async publishTracks(): Promise<void> {
    return this.enqueueOperation(() => this._publishTracksInternal());
  }

  private async _publishTracksInternal(): Promise<void> {
    // Wait for any pending renegotiation
    await this.waitForRenegotiation();
    
    if (!this.peerConnection || !this.localStream || !this.sessionId) {
      throw new Error('Not initialized');
    }

    // Add all tracks to peer connection
    for (const track of this.localStream.getTracks()) {
      console.log('[CloudflareCall] Adding track:', track.kind, 'id:', track.id);
      this.peerConnection.addTransceiver(track, {
        direction: 'sendonly',
        streams: [this.localStream],
      });
    }

    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering
    await this.waitForIceGathering(this.peerConnection);

    const localDesc = this.peerConnection.localDescription;
    this.localTrackName = `call-${this.userId.slice(0, 8)}-${Date.now()}`;

    console.log('[CloudflareCall] Publishing track:', this.localTrackName);

    // Push tracks to SFU
    const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
      body: {
        action: 'push-track',
        sessionId: this.sessionId,
        sdp: localDesc?.sdp || offer.sdp,
        trackName: this.localTrackName,
      },
    });

    if (error) {
      console.error('[CloudflareCall] Push track error:', error);
      throw error;
    }
    if (!data.success) {
      console.error('[CloudflareCall] Push track failed:', data.error);
      throw new Error(data.error || 'Failed to push track');
    }

    console.log('[CloudflareCall] Got SFU response:', data.sessionDescription?.type);

    // Handle response
    if (data.sessionDescription) {
      if (data.sessionDescription.type === 'answer') {
        await this.peerConnection.setRemoteDescription({
          type: 'answer',
          sdp: data.sessionDescription.sdp,
        });
        console.log('[CloudflareCall] ✅ Local tracks published successfully');
      } else if (data.sessionDescription.type === 'offer') {
        // Track renegotiation as pending
        const renegotiatePromise = (async () => {
          await this.peerConnection!.setRemoteDescription({
            type: 'offer',
            sdp: data.sessionDescription.sdp,
          });
          const answer = await this.peerConnection!.createAnswer();
          await this.peerConnection!.setLocalDescription(answer);
          await this.waitForIceGathering(this.peerConnection!);
          
          await this.renegotiate(this.peerConnection!.localDescription?.sdp || answer.sdp);
        })();
        
        this.pendingRenegotiation = renegotiatePromise;
        await renegotiatePromise;
        this.pendingRenegotiation = null;
      }
    }

    // Store our signal in database for peer discovery
    console.log('[CloudflareCall] Storing track info in database for peer:', this.otherUserId);
    await supabase
      .from('call_signals')
      .insert({
        call_id: this.callId,
        from_user_id: this.userId,
        to_user_id: this.otherUserId,
        signal_data: {
          type: 'track-info',
          sessionId: this.sessionId,
          trackName: this.localTrackName,
          timestamp: Date.now(),
        },
      });
  }

  /**
   * Renegotiate with SFU
   */
  private async renegotiate(sdp: string): Promise<void> {
    if (!this.sessionId) return;

    console.log('[CloudflareCall] 🔄 Sending renegotiation answer...');
    const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
      body: {
        action: 'renegotiate',
        sessionId: this.sessionId,
        sdp,
      },
    });

    if (error) {
      console.error('[CloudflareCall] ❌ Renegotiate error:', error);
      throw error;
    }
    console.log('[CloudflareCall] ✅ Renegotiation complete');
  }

  /**
   * Set up real-time signaling channel
   */
  private async setupSignaling(): Promise<void> {
    const channelName = `call-sfu:${this.callId}`;
    console.log('[CloudflareCall] Setting up signaling channel:', channelName);

    this.signalChannel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: this.userId },
        },
      })
      .on('broadcast', { event: 'track-info' }, async ({ payload }) => {
        console.log('[CloudflareCall] Received broadcast track-info from:', payload.userId);
        if (payload.userId !== this.userId && !this.isSubscribedToRemote) {
          console.log('[CloudflareCall] Processing peer track info from broadcast');
          await this.subscribeToRemote(payload.sessionId, payload.trackName);
        }
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log('[CloudflareCall] Peer joined presence:', key);
        // When peer joins, immediately broadcast our track info
        if (key !== this.userId && this.sessionId && this.localTrackName) {
          console.log('[CloudflareCall] Sending track info to new peer');
          this.broadcastTrackInfo();
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.signalChannel?.presenceState() || {};
        const peers = Object.keys(state);
        console.log('[CloudflareCall] Presence sync, peers online:', peers);
        
        // If peer is already online, broadcast our info
        if (peers.some(p => p !== this.userId) && this.sessionId && this.localTrackName && !this.isSubscribedToRemote) {
          console.log('[CloudflareCall] Peer already online, sending track info');
          this.broadcastTrackInfo();
        }
      });

    await this.signalChannel.subscribe(async (status) => {
      console.log('[CloudflareCall] Signal channel status:', status);
      if (status === 'SUBSCRIBED') {
        await this.signalChannel?.track({
          online_at: new Date().toISOString(),
          user_id: this.userId,
        });
        
        // Broadcast our track info immediately after subscribing
        if (this.sessionId && this.localTrackName) {
          setTimeout(() => this.broadcastTrackInfo(), 500);
        }
      }
    });
  }

  /**
   * Set up database-based signaling as backup
   */
  private setupDatabaseSignaling(): void {
    const channelName = `call-db-signals:${this.callId}`;
    console.log('[CloudflareCall] Setting up database signal listener:', channelName);

    this.dbSignalChannel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `call_id=eq.${this.callId}`,
      }, async (payload) => {
        const signal = payload.new as any;
        console.log('[CloudflareCall] Database signal received from:', signal.from_user_id);
        
        if (signal.from_user_id !== this.userId && !this.isSubscribedToRemote) {
          const signalData = signal.signal_data as any;
          if (signalData.type === 'track-info') {
            console.log('[CloudflareCall] Processing peer track info from database');
            await this.subscribeToRemote(signalData.sessionId, signalData.trackName);
          }
        }
      })
      .subscribe((status) => {
        console.log('[CloudflareCall] Database signal channel status:', status);
      });
  }

  /**
   * Broadcast track info to peer
   */
  private broadcastTrackInfo(): void {
    if (!this.sessionId || !this.localTrackName || !this.signalChannel) return;
    
    console.log('[CloudflareCall] Broadcasting track info');
    this.signalChannel.send({
      type: 'broadcast',
      event: 'track-info',
      payload: {
        userId: this.userId,
        sessionId: this.sessionId,
        trackName: this.localTrackName,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Start periodic track broadcasting until connected
   */
  private startTrackBroadcasting(): void {
    if (this.trackBroadcastInterval) return;
    
    console.log('[CloudflareCall] Starting periodic track broadcast');
    this.trackBroadcastInterval = setInterval(() => {
      if (!this.isSubscribedToRemote) {
        this.broadcastTrackInfo();
      } else {
        this.stopTrackBroadcasting();
      }
    }, 3000);
  }

  /**
   * Stop track broadcasting
   */
  private stopTrackBroadcasting(): void {
    if (this.trackBroadcastInterval) {
      console.log('[CloudflareCall] Stopping track broadcast');
      clearInterval(this.trackBroadcastInterval);
      this.trackBroadcastInterval = null;
    }
  }

  /**
   * Start polling for peer signals as backup
   */
  private startPeerDiscoveryPolling(): void {
    if (this.peerDiscoveryInterval) return;
    
    console.log('[CloudflareCall] Starting peer discovery polling');
    let attempts = 0;
    const maxAttempts = 20; // 40 seconds total (every 2 seconds)
    
    // Check immediately first
    this.checkForExistingPeerSignals();
    
    this.peerDiscoveryInterval = setInterval(async () => {
      if (this.isSubscribedToRemote || attempts >= maxAttempts) {
        this.stopPeerDiscoveryPolling();
        return;
      }
      attempts++;
      console.log('[CloudflareCall] Polling for peer signal, attempt:', attempts);
      await this.checkForExistingPeerSignals();
    }, 2000);
  }

  /**
   * Stop peer discovery polling
   */
  private stopPeerDiscoveryPolling(): void {
    if (this.peerDiscoveryInterval) {
      console.log('[CloudflareCall] Stopping peer discovery polling');
      clearInterval(this.peerDiscoveryInterval);
      this.peerDiscoveryInterval = null;
    }
  }

  /**
   * Check for existing peer signals in database
   */
  private async checkForExistingPeerSignals(): Promise<void> {
    if (this.isSubscribedToRemote) return;
    
    console.log('[CloudflareCall] Checking database for peer signals from:', this.otherUserId);
    
    const { data: signals, error } = await supabase
      .from('call_signals')
      .select('*')
      .eq('call_id', this.callId)
      .eq('from_user_id', this.otherUserId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[CloudflareCall] Error fetching peer signals:', error);
      return;
    }

    if (signals && signals.length > 0) {
      const signal = signals[0].signal_data as any;
      if (signal.type === 'track-info' && !this.isSubscribedToRemote) {
        console.log('[CloudflareCall] ✅ Found existing peer signal in database:', signal.trackName);
        await this.subscribeToRemote(signal.sessionId, signal.trackName);
      }
    } else {
      console.log('[CloudflareCall] No peer signals found yet');
    }
  }

  /**
   * Subscribe to remote peer's tracks - serialized through operation queue
   */
  private async subscribeToRemote(remoteSessionId: string, remoteTrackName: string): Promise<void> {
    return this.enqueueOperation(() => this._subscribeToRemoteInternal(remoteSessionId, remoteTrackName));
  }

  private async _subscribeToRemoteInternal(remoteSessionId: string, remoteTrackName: string): Promise<void> {
    // Wait for any pending renegotiation
    await this.waitForRenegotiation();
    
    if (!this.peerConnection || !this.sessionId) {
      console.log('[CloudflareCall] Cannot subscribe - not initialized');
      return;
    }
    
    if (this.isSubscribedToRemote) {
      console.log('[CloudflareCall] Already subscribed to remote, skipping');
      return;
    }

    console.log('[CloudflareCall] 🎧 Subscribing to remote:', remoteSessionId.slice(0, 8), remoteTrackName);
    this.isSubscribedToRemote = true;
    this.updateStatus('negotiating', 'Receiving remote stream...');

    try {
      // Add recvonly transceivers for receiving
      console.log('[CloudflareCall] Adding recvonly transceivers');
      this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });
      if (this.isVideoCall) {
        this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
      }

      // Request tracks from SFU
      console.log('[CloudflareCall] Requesting tracks from SFU');
      const { data, error } = await supabase.functions.invoke('cloudflare-sfu', {
        body: {
          action: 'pull-tracks',
          sessionId: this.sessionId,
          remoteTracks: [{
            location: 'remote',
            sessionId: remoteSessionId,
            trackName: remoteTrackName,
          }],
        },
      });

      if (error) {
        console.error('[CloudflareCall] Failed to pull tracks:', error);
        this.isSubscribedToRemote = false;
        throw error;
      }

      if (!data.success) {
        console.error('[CloudflareCall] Pull tracks failed:', data.error);
        this.isSubscribedToRemote = false;
        throw new Error(data.error || 'Failed to pull tracks');
      }

      console.log('[CloudflareCall] Pull tracks response:', data.sessionDescription?.type);

      // Handle SFU response (usually an offer)
      if (data.sessionDescription?.type === 'offer') {
        // Track renegotiation as pending
        const renegotiatePromise = (async () => {
          await this.peerConnection!.setRemoteDescription({
            type: 'offer',
            sdp: data.sessionDescription.sdp,
          });

          const answer = await this.peerConnection!.createAnswer();
          await this.peerConnection!.setLocalDescription(answer);
          await this.waitForIceGathering(this.peerConnection!);

          await this.renegotiate(this.peerConnection!.localDescription?.sdp || answer.sdp);
        })();
        
        this.pendingRenegotiation = renegotiatePromise;
        await renegotiatePromise;
        this.pendingRenegotiation = null;
        
        console.log('[CloudflareCall] ✅ Successfully subscribed to remote tracks');
        
        // Clear timeouts and stop polling
        this.clearConnectionTimeout();
        this.stopPeerDiscoveryPolling();
        this.stopTrackBroadcasting();
      }
    } catch (error) {
      console.error('[CloudflareCall] Error subscribing to remote:', error);
      this.isSubscribedToRemote = false;
      this.updateStatus('failed', 'Failed to receive remote stream');
    }
  }

  /**
   * Start monitoring network quality
   */
  private startNetworkQualityMonitoring(): void {
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
          if (report.type === 'inbound-rtp') {
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
            bytesReceived += report.bytesReceived || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            roundTripTime = (report.currentRoundTripTime || 0) * 1000;
          }
        });

        const now = Date.now();
        const timeDiff = (now - lastTimestamp) / 1000;
        const bitrate = Math.round(((bytesReceived - lastBytesReceived) * 8) / timeDiff / 1000);
        lastBytesReceived = bytesReceived;
        lastTimestamp = now;

        const totalPackets = packetsReceived + packetsLost;
        const packetLoss = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

        let quality: NetworkQuality['quality'] = 'excellent';
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
        console.warn('[CloudflareCall] Error getting stats:', error);
      }
    }, 2000);
  }

  /**
   * Toggle microphone mute
   */
  toggleMute(): boolean {
    if (!this.localStream) return false;
    
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle video
   */
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Flip camera (mobile)
   */
  async flipCamera(): Promise<boolean> {
    if (!this.localStream || !this.isVideoCall) return false;

    try {
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      oldVideoTrack.stop();
      this.localStream.removeTrack(oldVideoTrack);
      this.localStream.addTrack(newVideoTrack);

      return true;
    } catch (error) {
      console.error('[CloudflareCall] Failed to flip camera:', error);
      return false;
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const videoTrack = this.screenStream.getVideoTracks()[0];
      
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (error) {
      console.error('[CloudflareCall] Failed to start screen share:', error);
      return null;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    // Restore camera video
    if (this.localStream && this.isVideoCall) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }
    }
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    console.log('[CloudflareCall] Cleaning up...');

    this.clearConnectionTimeout();
    this.stopPeerDiscoveryPolling();
    this.stopTrackBroadcasting();

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.signalChannel) {
      await supabase.removeChannel(this.signalChannel);
      this.signalChannel = null;
    }

    if (this.dbSignalChannel) {
      await supabase.removeChannel(this.dbSignalChannel);
      this.dbSignalChannel = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.sessionId = null;
    this.localTrackName = null;
    this.isSubscribedToRemote = false;
  }
}
