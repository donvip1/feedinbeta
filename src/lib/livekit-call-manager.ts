import { Room, RoomEvent, Track, LocalParticipant, RemoteParticipant, ConnectionState, LocalTrack, RemoteTrack, RemoteTrackPublication } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

export type CallConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed' | 'ringing' | 'ended' | 'waiting_for_peer';

export interface CallManagerCallbacks {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onRemoteAudioTrack: (track: MediaStreamTrack) => void;
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
  private hasRemoteParticipant: boolean = false;
  private audioElements: HTMLAudioElement[] = [];

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
      // Unlock audio context on mobile by creating a silent audio context
      await this.unlockAudioContext();
      
      // Get LiveKit token - IMPORTANT: Both participants can publish in a call
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: `call-${this.callId}`,
          participantIdentity: this.userId,
          participantName: displayName,
          isHost: true, // Both participants should be able to publish audio/video
        },
      });

      if (tokenError || !tokenData?.token) {
        throw new Error(tokenError?.message || 'Failed to get call token');
      }

      console.log('[LiveKitCallManager] Got token, connecting to room...');
      this.updateStatus('connecting', 'Connecting to call...');

      // Create and configure room with optimized settings for calls
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
        // Optimize for real-time communication
        publishDefaults: {
          audioPreset: { maxBitrate: 48_000 },
          dtx: true, // Discontinuous transmission - saves bandwidth when silent
          red: true, // Redundancy encoding for packet loss resilience
        },
      });

      // Set up room event listeners BEFORE connecting
      this.setupRoomEvents();

      // Connect to room
      await this.room.connect(tokenData.url, tokenData.token);
      console.log('[LiveKitCallManager] Connected to room');

      // Subscribe to call status changes for synchronized ending
      this.subscribeToCallEnd();

      // Enable camera and microphone
      this.updateStatus('connecting', 'Setting up media...');
      
      if (isVideo) {
        await this.room.localParticipant.enableCameraAndMicrophone();
      } else {
        // Voice call - only enable microphone
        await this.room.localParticipant.setMicrophoneEnabled(true);
      }

      // Create local stream from published tracks
      this.localStream = this.createMediaStreamFromParticipant(this.room.localParticipant);
      
      if (this.localStream) {
        this.callbacks.onLocalStream(this.localStream);
      }

      // Check if other participant is already in the room
      if (this.room.remoteParticipants.size > 0) {
        console.log('[LiveKitCallManager] Remote participant already in room');
        this.hasRemoteParticipant = true;
        this.updateStatus('connected', 'Connected');
        
        // Attach existing remote tracks
        this.room.remoteParticipants.forEach((participant) => {
          this.handleExistingParticipant(participant);
        });
      } else {
        console.log('[LiveKitCallManager] Waiting for other participant...');
        this.updateStatus('waiting_for_peer', 'Waiting for other user...');
      }

      return this.localStream!;
    } catch (error: any) {
      console.error('[LiveKitCallManager] Error initializing:', error);
      this.updateStatus('failed', error.message);
      this.callbacks.onError(error);
      throw error;
    }
  }

  private async unlockAudioContext(): Promise<void> {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        // Create and play a silent buffer
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        console.log('[LiveKitCallManager] Audio context unlocked');
      }
    } catch (error) {
      console.warn('[LiveKitCallManager] Could not unlock audio context:', error);
    }
  }

  private handleExistingParticipant(participant: RemoteParticipant) {
    participant.trackPublications.forEach((publication) => {
      if (publication.track && publication.isSubscribed) {
        this.handleTrackSubscribed(publication.track as RemoteTrack, publication as RemoteTrackPublication, participant);
      }
    });
  }

  private handleTrackSubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
    console.log('[LiveKitCallManager] Track subscribed:', track.kind, 'from', participant.identity);
    
    if (track.kind === 'audio') {
      // For audio tracks, attach directly to an audio element for reliable playback
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      (audioElement as any).playsInline = true;
      
      // Attach the track to the audio element
      track.attach(audioElement);
      this.audioElements.push(audioElement);
      
      // Try to play with error handling for autoplay policy
      audioElement.play().catch(async (error) => {
        console.warn('[LiveKitCallManager] Audio autoplay blocked, trying to resume:', error);
        // Most likely blocked by autoplay policy, try again
        await this.unlockAudioContext();
        audioElement.play().catch(e => console.error('[LiveKitCallManager] Still cannot play audio:', e));
      });
      
      // Also send the track to callback for reference
      if (track.mediaStreamTrack) {
        this.callbacks.onRemoteAudioTrack(track.mediaStreamTrack);
      }
    }
    
    // Update remote stream (for video and combined stream)
    this.remoteStream = this.createMediaStreamFromParticipant(participant);
    if (this.remoteStream) {
      this.callbacks.onRemoteStream(this.remoteStream);
    }
  }

  private setupRoomEvents() {
    if (!this.room) return;

    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log('[LiveKitCallManager] Connection state:', state);
      
      switch (state) {
        case ConnectionState.Connected:
          if (this.hasRemoteParticipant) {
            this.updateStatus('connected', 'Connected');
          }
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
      this.hasRemoteParticipant = true;
      this.callbacks.onParticipantJoined?.(participant.identity, participant.name || 'Unknown');
      
      // Update status to connected when other participant joins
      this.updateStatus('connected', 'Connected');
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('[LiveKitCallManager] Participant disconnected:', participant.identity);
      this.callbacks.onParticipantLeft?.(participant.identity);
      
      // If the other participant leaves, end the call
      if (this.room && this.room.remoteParticipants.size === 0) {
        console.log('[LiveKitCallManager] No more remote participants, ending call');
        this.hasRemoteParticipant = false;
        
        // Update call log to ended in database
        this.markCallEnded();
        
        this.callbacks.onCallEnded?.();
      }
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      this.handleTrackSubscribed(track, publication, participant);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[LiveKitCallManager] Track unsubscribed:', track.kind);
      
      // Detach audio element if it was an audio track
      if (track.kind === 'audio') {
        track.detach();
      }
      
      // Update remote stream
      this.remoteStream = this.createMediaStreamFromParticipant(participant);
      if (this.remoteStream) {
        this.callbacks.onRemoteStream(this.remoteStream);
      }
    });

    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.log('[LiveKitCallManager] Room disconnected, reason:', reason);
      this.updateStatus('disconnected', 'Call ended');
      this.cleanupAudioElements();
      this.callbacks.onCallEnded?.();
    });

    this.room.on(RoomEvent.MediaDevicesError, (error: Error) => {
      console.error('[LiveKitCallManager] Media devices error:', error);
      this.callbacks.onError(error);
    });

    // Handle reconnection
    this.room.on(RoomEvent.Reconnected, () => {
      console.log('[LiveKitCallManager] Reconnected to room');
      if (this.hasRemoteParticipant || this.room!.remoteParticipants.size > 0) {
        this.updateStatus('connected', 'Connected');
      } else {
        this.updateStatus('waiting_for_peer', 'Waiting for other user...');
      }
    });
  }

  private cleanupAudioElements() {
    this.audioElements.forEach(el => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    this.audioElements = [];
  }

  private async markCallEnded() {
    try {
      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', this.callId);
      console.log('[LiveKitCallManager] Call marked as ended in database');
    } catch (error) {
      console.error('[LiveKitCallManager] Error marking call as ended:', error);
    }
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
    console.log('[LiveKitCallManager] Subscribing to call end events for:', this.callId);
    
    this.callEndSubscription = supabase
      .channel(`call-end-${this.callId}-${Date.now()}`)
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
          console.log('[LiveKitCallManager] Call status update received:', newStatus);
          
          if (newStatus === 'ended' || newStatus === 'rejected') {
            console.log('[LiveKitCallManager] Call ended by other party');
            this.callbacks.onCallEnded?.();
          }
        }
      )
      .subscribe((status) => {
        console.log('[LiveKitCallManager] Call end subscription status:', status);
      });
  }

  async toggleMute(): Promise<boolean> {
    if (!this.room) return false;
    
    const isEnabled = this.room.localParticipant.isMicrophoneEnabled;
    await this.room.localParticipant.setMicrophoneEnabled(!isEnabled);
    
    return !isEnabled; // Returns new enabled state
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

  hasRemotePeer(): boolean {
    return this.hasRemoteParticipant;
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
    
    // Clean up audio elements
    this.cleanupAudioElements();
    
    // Disconnect from room
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    
    // Clean up streams
    this.localStream = null;
    this.remoteStream = null;
    this.isScreenSharing = false;
    this.hasRemoteParticipant = false;
    
    this.updateStatus('disconnected', 'Disconnected');
  }
}
