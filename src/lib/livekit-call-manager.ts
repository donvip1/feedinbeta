import { Room, RoomEvent, Track, LocalParticipant, RemoteParticipant, ConnectionState, LocalTrack, RemoteTrack } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

export type CallConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed' | 'ringing' | 'ended';

export interface CallManagerCallbacks {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onStatusChange: (status: CallConnectionStatus, message?: string) => void;
  onError: (error: Error) => void;
  onParticipantJoined?: (participantId: string, participantName: string) => void;
  onParticipantLeft?: (participantId: string) => void;
  onCallEnded?: () => void;
}

export class LiveKitCallManager {
  private room: Room | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: CallManagerCallbacks;
  private callId: string;
  private userId: string;
  private isVideo: boolean = false;
  private isScreenSharing: boolean = false;
  private screenTrack: LocalTrack | null = null;
  private currentStatus: CallConnectionStatus = 'idle';
  private callEndSubscription: ReturnType<typeof supabase.channel> | null = null;

  constructor(callId: string, userId: string, callbacks: CallManagerCallbacks) {
    this.callId = callId;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  private updateStatus(status: CallConnectionStatus, message?: string) {
    this.currentStatus = status;
    this.callbacks.onStatusChange(status, message);
  }

  async initialize(isVideo: boolean, displayName: string): Promise<MediaStream> {
    console.log('[LiveKitCallManager] Initializing call:', { callId: this.callId, isVideo, displayName });
    this.isVideo = isVideo;
    this.updateStatus('connecting', 'Getting call token...');

    try {
      // Get LiveKit token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `call-${this.callId}`,
          participantIdentity: this.userId,
          participantName: displayName,
          isHost: true, // Both participants can publish in a call
        },
      });

      if (tokenError || !tokenData?.token) {
        throw new Error(tokenError?.message || 'Failed to get call token');
      }

      console.log('[LiveKitCallManager] Got token, connecting to room...');
      this.updateStatus('connecting', 'Connecting to call...');

      // Create and configure room
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Set up room event listeners
      this.setupRoomEvents();

      // Connect to room
      await this.room.connect(tokenData.url, tokenData.token);
      console.log('[LiveKitCallManager] Connected to room');

      // Subscribe to call status changes for synchronized ending
      this.subscribeToCallEnd();

      // Enable camera and microphone
      this.updateStatus('connecting', 'Setting up media...');
      await this.room.localParticipant.enableCameraAndMicrophone();

      // Create local stream from published tracks
      this.localStream = this.createMediaStreamFromParticipant(this.room.localParticipant);
      
      if (this.localStream) {
        this.callbacks.onLocalStream(this.localStream);
      }

      // If video call, disable video if isVideo is false
      if (!isVideo) {
        await this.room.localParticipant.setCameraEnabled(false);
      }

      return this.localStream!;
    } catch (error: any) {
      console.error('[LiveKitCallManager] Error initializing:', error);
      this.updateStatus('failed', error.message);
      this.callbacks.onError(error);
      throw error;
    }
  }

  private setupRoomEvents() {
    if (!this.room) return;

    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log('[LiveKitCallManager] Connection state:', state);
      
      switch (state) {
        case ConnectionState.Connected:
          this.updateStatus('connected', 'Connected');
          break;
        case ConnectionState.Reconnecting:
          this.updateStatus('reconnecting', 'Reconnecting...');
          break;
        case ConnectionState.Disconnected:
          this.updateStatus('disconnected', 'Disconnected');
          break;
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[LiveKitCallManager] Participant connected:', participant.identity);
      this.callbacks.onParticipantJoined?.(participant.identity, participant.name || 'Unknown');
      
      // Update status to connected when other participant joins
      this.updateStatus('connected', 'Connected');
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('[LiveKitCallManager] Participant disconnected:', participant.identity);
      this.callbacks.onParticipantLeft?.(participant.identity);
      
      // If the other participant leaves, end the call
      if (this.room && this.room.remoteParticipants.size === 0) {
        this.callbacks.onCallEnded?.();
      }
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
      console.log('[LiveKitCallManager] Track subscribed:', track.kind, 'from', participant.identity);
      
      // Update remote stream
      this.remoteStream = this.createMediaStreamFromParticipant(participant);
      if (this.remoteStream) {
        this.callbacks.onRemoteStream(this.remoteStream);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
      console.log('[LiveKitCallManager] Track unsubscribed:', track.kind);
      
      // Update remote stream
      this.remoteStream = this.createMediaStreamFromParticipant(participant);
      if (this.remoteStream) {
        this.callbacks.onRemoteStream(this.remoteStream);
      }
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKitCallManager] Room disconnected');
      this.updateStatus('disconnected', 'Call ended');
      this.callbacks.onCallEnded?.();
    });

    this.room.on(RoomEvent.MediaDevicesError, (error: Error) => {
      console.error('[LiveKitCallManager] Media devices error:', error);
      this.callbacks.onError(error);
    });
  }

  private createMediaStreamFromParticipant(participant: LocalParticipant | RemoteParticipant): MediaStream | null {
    const tracks: MediaStreamTrack[] = [];
    
    participant.trackPublications.forEach((publication) => {
      if (publication.track && publication.track.mediaStreamTrack) {
        tracks.push(publication.track.mediaStreamTrack);
      }
    });

    if (tracks.length === 0) return null;
    return new MediaStream(tracks);
  }

  private subscribeToCallEnd() {
    this.callEndSubscription = supabase
      .channel(`call-end-${this.callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `id=eq.${this.callId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          console.log('[LiveKitCallManager] Call status update:', newStatus);
          
          if (newStatus === 'ended' || newStatus === 'rejected') {
            this.callbacks.onCallEnded?.();
          }
        }
      )
      .subscribe();
  }

  async toggleMute(): Promise<boolean> {
    if (!this.room) return false;
    
    const isMuted = this.room.localParticipant.isMicrophoneEnabled;
    await this.room.localParticipant.setMicrophoneEnabled(!isMuted);
    
    return !isMuted; // Returns new enabled state
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.room) return false;
    
    const isEnabled = this.room.localParticipant.isCameraEnabled;
    await this.room.localParticipant.setCameraEnabled(!isEnabled);
    
    // Update local stream
    this.localStream = this.createMediaStreamFromParticipant(this.room.localParticipant);
    if (this.localStream) {
      this.callbacks.onLocalStream(this.localStream);
    }
    
    return !isEnabled; // Returns new enabled state
  }

  async flipCamera(): Promise<boolean> {
    if (!this.room) return false;
    
    try {
      // Get current facing mode
      const videoTrack = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (!videoTrack?.track) return false;
      
      const currentSettings = videoTrack.track.mediaStreamTrack?.getSettings();
      const currentFacingMode = currentSettings?.facingMode || 'user';
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      // Disable and re-enable with new facing mode
      await this.room.localParticipant.setCameraEnabled(false);
      await this.room.localParticipant.setCameraEnabled(true, {
        facingMode: newFacingMode,
      });
      
      // Update local stream
      this.localStream = this.createMediaStreamFromParticipant(this.room.localParticipant);
      if (this.localStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
      
      return true;
    } catch (error) {
      console.error('[LiveKitCallManager] Error flipping camera:', error);
      return false;
    }
  }

  async startScreenShare(): Promise<boolean> {
    if (!this.room || this.isScreenSharing) return false;
    
    try {
      await this.room.localParticipant.setScreenShareEnabled(true);
      this.isScreenSharing = true;
      
      // Update local stream
      this.localStream = this.createMediaStreamFromParticipant(this.room.localParticipant);
      if (this.localStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
      
      return true;
    } catch (error) {
      console.error('[LiveKitCallManager] Error starting screen share:', error);
      return false;
    }
  }

  async stopScreenShare(): Promise<boolean> {
    if (!this.room || !this.isScreenSharing) return false;
    
    try {
      await this.room.localParticipant.setScreenShareEnabled(false);
      this.isScreenSharing = false;
      
      // Update local stream
      this.localStream = this.createMediaStreamFromParticipant(this.room.localParticipant);
      if (this.localStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
      
      return true;
    } catch (error) {
      console.error('[LiveKitCallManager] Error stopping screen share:', error);
      return false;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  isConnected(): boolean {
    return this.currentStatus === 'connected';
  }

  getStatus(): CallConnectionStatus {
    return this.currentStatus;
  }

  async disconnect(): Promise<void> {
    console.log('[LiveKitCallManager] Disconnecting...');
    
    // Unsubscribe from call end updates
    if (this.callEndSubscription) {
      await supabase.removeChannel(this.callEndSubscription);
      this.callEndSubscription = null;
    }
    
    // Stop screen share if active
    if (this.isScreenSharing) {
      await this.stopScreenShare();
    }
    
    // Disconnect from room
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    
    // Clean up streams
    this.localStream = null;
    this.remoteStream = null;
    this.isScreenSharing = false;
    
    this.updateStatus('disconnected', 'Disconnected');
  }
}