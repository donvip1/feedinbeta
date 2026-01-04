/**
 * Live Stream P2P Manager
 * Simple WebRTC P2P for live streaming - instant connection like video calls
 * Uses Supabase Realtime for signaling
 */

import { supabase } from '@/integrations/supabase/client';

export type StreamRole = 'broadcaster' | 'viewer';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface StreamCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onStatusChange?: (status: ConnectionStatus, message?: string) => void;
  onViewerJoined?: (viewerId: string) => void;
  onViewerLeft?: (viewerId: string) => void;
  onError?: (error: Error) => void;
}

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'viewer-join' | 'viewer-leave';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  viewerId?: string;
  broadcasterId?: string;
}

// Default STUN servers - free and reliable
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class LiveStreamP2P {
  private streamId: string;
  private userId: string;
  private role: StreamRole;
  private callbacks: StreamCallbacks;
  
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private realtimeChannel: any = null;
  private status: ConnectionStatus = 'idle';
  private isDestroyed = false;

  constructor(
    streamId: string,
    userId: string,
    role: StreamRole,
    callbacks: StreamCallbacks
  ) {
    this.streamId = streamId;
    this.userId = userId;
    this.role = role;
    this.callbacks = callbacks;
    
    console.log(`[P2P-Stream] Initialized as ${role}:`, streamId.slice(0, 8));
  }

  // ==================== BROADCASTER METHODS ====================

  async startBroadcast(mediaStream: MediaStream): Promise<void> {
    if (this.role !== 'broadcaster') {
      throw new Error('Only broadcaster can start broadcast');
    }

    this.localStream = mediaStream;
    this.updateStatus('connecting', 'Starting broadcast...');
    
    // Setup realtime signaling channel
    await this.setupSignaling();
    
    // Update database - stream is now live
    await supabase
      .from('live_streams')
      .update({ 
        status: 'live', 
        stream_ready: true,
        started_at: new Date().toISOString(),
        connection_state: 'live'
      })
      .eq('id', this.streamId);

    this.updateStatus('connected', 'Broadcasting');
    console.log('[P2P-Stream] Broadcast started, waiting for viewers...');
  }

  private async handleViewerJoin(viewerId: string): Promise<void> {
    if (this.isDestroyed || !this.localStream) return;
    
    console.log('[P2P-Stream] Viewer joining:', viewerId.slice(0, 8));
    
    // Create peer connection for this viewer
    const pc = this.createPeerConnection(viewerId);
    this.peerConnections.set(viewerId, pc);
    
    // Add local tracks
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });
    
    // Create and send offer
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering
      await this.waitForIceGathering(pc);
      
      // Send offer to viewer
      await this.sendSignal(viewerId, {
        type: 'offer',
        sdp: pc.localDescription?.sdp,
        broadcasterId: this.userId,
      });
      
      console.log('[P2P-Stream] Offer sent to viewer:', viewerId.slice(0, 8));
      this.callbacks.onViewerJoined?.(viewerId);
    } catch (error) {
      console.error('[P2P-Stream] Failed to create offer:', error);
      pc.close();
      this.peerConnections.delete(viewerId);
    }
  }

  private async handleViewerAnswer(viewerId: string, sdp: string): Promise<void> {
    const pc = this.peerConnections.get(viewerId);
    if (!pc) return;
    
    console.log('[P2P-Stream] Received answer from viewer:', viewerId.slice(0, 8));
    
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp });
    } catch (error) {
      console.error('[P2P-Stream] Failed to set answer:', error);
    }
  }

  private handleViewerLeft(viewerId: string): void {
    const pc = this.peerConnections.get(viewerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(viewerId);
      this.callbacks.onViewerLeft?.(viewerId);
      console.log('[P2P-Stream] Viewer left:', viewerId.slice(0, 8));
    }
  }

  // ==================== VIEWER METHODS ====================

  async joinStream(): Promise<void> {
    if (this.role !== 'viewer') {
      throw new Error('Only viewer can join stream');
    }

    this.updateStatus('connecting', 'Joining stream...');
    
    // Setup realtime signaling channel
    await this.setupSignaling();
    
    // Notify broadcaster that we want to join
    await this.broadcastSignal({
      type: 'viewer-join',
      viewerId: this.userId,
    });
    
    console.log('[P2P-Stream] Join request sent, waiting for broadcaster...');
  }

  private async handleOffer(broadcasterId: string, sdp: string): Promise<void> {
    if (this.isDestroyed) return;
    
    console.log('[P2P-Stream] Received offer from broadcaster');
    
    // Create peer connection
    const pc = this.createPeerConnection(broadcasterId);
    this.peerConnections.set(broadcasterId, pc);
    
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Wait for ICE gathering
      await this.waitForIceGathering(pc);
      
      // Send answer to broadcaster
      await this.sendSignal(broadcasterId, {
        type: 'answer',
        sdp: pc.localDescription?.sdp,
        viewerId: this.userId,
      });
      
      console.log('[P2P-Stream] Answer sent to broadcaster');
    } catch (error) {
      console.error('[P2P-Stream] Failed to handle offer:', error);
      this.updateStatus('failed', 'Connection failed');
    }
  }

  // ==================== SHARED METHODS ====================

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming tracks (for viewers)
    pc.ontrack = (event) => {
      console.log('[P2P-Stream] Received track:', event.track.kind);
      if (event.streams[0]) {
        this.callbacks.onRemoteStream?.(event.streams[0]);
        this.updateStatus('connected', 'Streaming');
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[P2P-Stream] Connection state:', state, 'for peer:', peerId.slice(0, 8));
      
      if (state === 'connected') {
        this.updateStatus('connected');
      } else if (state === 'disconnected') {
        this.updateStatus('reconnecting', 'Reconnecting...');
      } else if (state === 'failed') {
        if (this.role === 'viewer') {
          this.updateStatus('failed', 'Connection lost');
        }
        // Remove failed connection
        pc.close();
        this.peerConnections.delete(peerId);
      }
    };

    return pc;
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) return;
    
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.warn('[P2P-Stream] Failed to add ICE candidate:', error);
    }
  }

  private async waitForIceGathering(pc: RTCPeerConnection, timeout = 2000): Promise<void> {
    if (pc.iceGatheringState === 'complete') return;
    
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeout);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  }

  private async setupSignaling(): Promise<void> {
    const channelName = `live-stream:${this.streamId}`;
    
    this.realtimeChannel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const message = payload.payload as SignalMessage & { from: string; to?: string };
        
        // Ignore our own messages
        if (message.from === this.userId) return;
        
        // If message has a target and it's not us, ignore
        if (message.to && message.to !== this.userId) return;
        
        await this.handleSignalMessage(message.from, message);
      })
      .subscribe((status) => {
        console.log('[P2P-Stream] Channel status:', status);
      });
  }

  private async handleSignalMessage(from: string, message: SignalMessage): Promise<void> {
    console.log('[P2P-Stream] Signal received:', message.type, 'from:', from.slice(0, 8));
    
    switch (message.type) {
      case 'viewer-join':
        if (this.role === 'broadcaster' && message.viewerId) {
          await this.handleViewerJoin(message.viewerId);
        }
        break;
        
      case 'viewer-leave':
        if (this.role === 'broadcaster' && message.viewerId) {
          this.handleViewerLeft(message.viewerId);
        }
        break;
        
      case 'offer':
        if (this.role === 'viewer' && message.sdp && message.broadcasterId) {
          await this.handleOffer(message.broadcasterId, message.sdp);
        }
        break;
        
      case 'answer':
        if (this.role === 'broadcaster' && message.sdp && message.viewerId) {
          await this.handleViewerAnswer(message.viewerId, message.sdp);
        }
        break;
        
      case 'ice-candidate':
        if (message.candidate) {
          await this.handleIceCandidate(from, message.candidate);
        }
        break;
    }
  }

  private async sendSignal(to: string, message: SignalMessage): Promise<void> {
    if (!this.realtimeChannel) return;
    
    await this.realtimeChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...message, from: this.userId, to },
    });
  }

  private async broadcastSignal(message: SignalMessage): Promise<void> {
    if (!this.realtimeChannel) return;
    
    await this.realtimeChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...message, from: this.userId },
    });
  }

  private updateStatus(status: ConnectionStatus, message?: string): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status, message);
  }

  // Replace tracks (for camera switch)
  async replaceTrack(newTrack: MediaStreamTrack): Promise<void> {
    const kind = newTrack.kind;
    
    for (const [peerId, pc] of this.peerConnections) {
      const sender = pc.getSenders().find(s => s.track?.kind === kind);
      if (sender) {
        await sender.replaceTrack(newTrack);
        console.log('[P2P-Stream] Track replaced for peer:', peerId.slice(0, 8));
      }
    }
    
    // Update local stream reference
    if (this.localStream) {
      const oldTrack = this.localStream.getTracks().find(t => t.kind === kind);
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
      }
      this.localStream.addTrack(newTrack);
    }
  }

  // Update local stream (for full stream replacement)
  updateLocalStream(newStream: MediaStream): void {
    this.localStream = newStream;
    this.callbacks.onLocalStream?.(newStream);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getViewerCount(): number {
    return this.peerConnections.size;
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;
    
    // Notify broadcaster we're leaving
    if (this.role === 'viewer') {
      this.broadcastSignal({
        type: 'viewer-leave',
        viewerId: this.userId,
      });
    }
    
    // Close all peer connections
    for (const [, pc] of this.peerConnections) {
      pc.close();
    }
    this.peerConnections.clear();
    
    // Unsubscribe from channel
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    console.log('[P2P-Stream] Destroyed');
  }
}
