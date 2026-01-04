import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

export type PlaybackStatus = 'idle' | 'waiting' | 'connecting' | 'buffering' | 'playing' | 'error';
export type PlaybackMethod = 'hls' | 'webrtc' | null;

interface UseCloudflarePlaybackProps {
  hlsUrl?: string | null;
  whepUrl?: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamReady?: boolean;
  onStatusChange?: (status: PlaybackStatus) => void;
}

interface PlaybackState {
  status: PlaybackStatus;
  method: PlaybackMethod;
  errorMessage: string | null;
  hasVideo: boolean;
  isBuffering: boolean;
  showUnmutePrompt: boolean;
  connectionQuality: 'good' | 'fair' | 'poor' | 'unknown';
}

export function useCloudflarePlayback({
  hlsUrl,
  whepUrl,
  videoRef,
  streamReady = true,
  onStatusChange,
}: UseCloudflarePlaybackProps) {
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const healthCheckIntervalRef = useRef<number | null>(null);
  const manifestCheckIntervalRef = useRef<number | null>(null);
  
  const [state, setState] = useState<PlaybackState>({
    status: 'idle',
    method: null,
    errorMessage: null,
    hasVideo: false,
    isBuffering: false,
    showUnmutePrompt: true,
    connectionQuality: 'unknown',
  });

  const retryCountRef = useRef(0);
  const maxRetries = 8; // Increased from 5 for better reliability
  const isConnectedRef = useRef(false);
  const streamReadyPollingRef = useRef<number | null>(null);

  // Update status and notify
  const updateStatus = useCallback((status: PlaybackStatus, errorMessage: string | null = null) => {
    setState(prev => ({ ...prev, status, errorMessage }));
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Cleanup all connections
  const cleanup = useCallback(() => {
    console.log('[CloudflarePlayback] Cleaning up...');
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (manifestCheckIntervalRef.current) {
      clearInterval(manifestCheckIntervalRef.current);
      manifestCheckIntervalRef.current = null;
    }
    
    if (streamReadyPollingRef.current) {
      clearInterval(streamReadyPollingRef.current);
      streamReadyPollingRef.current = null;
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    
    isConnectedRef.current = false;
  }, [videoRef]);

  // Check if manifest is accessible before connecting
  const checkManifestAccessible = useCallback(async (): Promise<boolean> => {
    if (!hlsUrl) return false;
    
    try {
      console.log('[CloudflarePlayback] Pre-checking manifest...');
      const response = await fetch(hlsUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        console.log('[CloudflarePlayback] Manifest is accessible');
        return true;
      }
      
      console.log('[CloudflarePlayback] Manifest not ready:', response.status);
      return false;
    } catch (error) {
      console.log('[CloudflarePlayback] Manifest check failed:', error);
      return false;
    }
  }, [hlsUrl]);

  // Connect via HLS
  const connectHLS = useCallback(async () => {
    if (!hlsUrl || !videoRef.current) {
      console.warn('[CloudflarePlayback] No HLS URL or video element');
      updateStatus('error', 'No stream URL available');
      return;
    }

    console.log('[CloudflarePlayback] Connecting via HLS:', hlsUrl);
    updateStatus('connecting');

    // First check if manifest is accessible
    const isAccessible = await checkManifestAccessible();
    if (!isAccessible) {
      console.log('[CloudflarePlayback] Manifest not accessible, will retry...');
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(2000 * retryCountRef.current, 8000);
        
        updateStatus('waiting', `Stream starting... (${retryCountRef.current}/${maxRetries})`);
        
        retryTimeoutRef.current = window.setTimeout(() => {
          connectHLS();
        }, delay);
        return;
      } else {
        updateStatus('error', 'Stream is not available. Host may not be broadcasting.');
        return;
      }
    }

    // Manifest is accessible, proceed with HLS connection
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxLoadingDelay: 4,
        maxBufferHole: 0.5,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[CloudflarePlayback] HLS manifest parsed, starting playback');
        retryCountRef.current = 0;
        isConnectedRef.current = true;
        
        // Verify video is actually playing with dimensions
        const video = videoRef.current;
        if (video) {
          video.onloadeddata = () => {
            console.log('[CloudflarePlayback] HLS video data loaded, dimensions:', 
              video.videoWidth, 'x', video.videoHeight);
            
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setState(prev => ({
                ...prev,
                hasVideo: true,
              }));
            }
          };
        }
        
        setState(prev => ({
          ...prev,
          status: 'playing',
          method: 'hls',
          hasVideo: true,
          errorMessage: null,
        }));
        
        videoRef.current?.play().catch(() => {
          setState(prev => ({ ...prev, showUnmutePrompt: true }));
        });
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setState(prev => ({ ...prev, isBuffering: false }));
      });

      // Handle stalling via video element events
      if (videoRef.current) {
        videoRef.current.onwaiting = () => {
          console.log('[CloudflarePlayback] Video waiting/stalling...');
          setState(prev => ({ ...prev, isBuffering: true, status: 'buffering' }));
        };
        videoRef.current.onplaying = () => {
          setState(prev => ({ ...prev, isBuffering: false, status: 'playing' }));
        };
      }

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[CloudflarePlayback] HLS error:', data.type, data.details, data.fatal);
        
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Network error - retry with backoff
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              const delay = Math.min(2000 * retryCountRef.current, 10000);
              
              console.log(`[CloudflarePlayback] Network error, retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`);
              updateStatus('waiting', `Reconnecting... (${retryCountRef.current}/${maxRetries})`);
              
              hls.destroy();
              retryTimeoutRef.current = window.setTimeout(() => {
                connectHLS();
              }, delay);
            } else {
              updateStatus('error', 'Connection lost. Please try again.');
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('[CloudflarePlayback] Media error, attempting recovery...');
            hls.recoverMediaError();
          } else {
            updateStatus('error', 'Failed to play stream');
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      console.log('[CloudflarePlayback] Using Safari native HLS');
      videoRef.current.src = hlsUrl;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('[CloudflarePlayback] Safari HLS loaded');
        retryCountRef.current = 0;
        isConnectedRef.current = true;
        
        setState(prev => ({
          ...prev,
          status: 'playing',
          method: 'hls',
          hasVideo: true,
          errorMessage: null,
        }));
        
        videoRef.current?.play().catch(() => {
          setState(prev => ({ ...prev, showUnmutePrompt: true }));
        });
      };
      
      videoRef.current.onerror = () => {
        console.error('[CloudflarePlayback] Safari HLS error');
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = 2000 * retryCountRef.current;
          updateStatus('waiting', `Reconnecting... (${retryCountRef.current}/${maxRetries})`);
          retryTimeoutRef.current = window.setTimeout(connectHLS, delay);
        } else {
          updateStatus('error', 'Unable to connect to stream');
        }
      };
    } else {
      updateStatus('error', 'Your browser does not support HLS playback');
    }
  }, [hlsUrl, videoRef, updateStatus, checkManifestAccessible]);

  // Connect via WebRTC WHEP (lower latency)
  const connectWHEP = useCallback(async () => {
    if (!whepUrl || !videoRef.current) {
      console.log('[CloudflarePlayback] No WHEP URL, falling back to HLS');
      connectHLS();
      return;
    }

    // Validate WHEP URL
    if (!/play|whep/i.test(whepUrl) || /publish|whip/i.test(whepUrl)) {
      console.warn('[CloudflarePlayback] Invalid WHEP URL (appears to be publish URL), using HLS');
      connectHLS();
      return;
    }

    console.log('[CloudflarePlayback] Connecting via WHEP:', whepUrl);
    updateStatus('connecting');

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    pcRef.current = pc;

    // Add transceivers for receiving
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    let gotTrack = false;

    pc.ontrack = (event) => {
      console.log('[CloudflarePlayback] Received track:', event.track.kind, 'readyState:', event.track.readyState);
      
      if (event.streams[0] && videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.muted = true;
        
        // For video tracks, verify video is actually playing with dimensions
        if (event.track.kind === 'video') {
          const checkVideoPlaying = () => {
            const video = videoRef.current;
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
              console.log('[CloudflarePlayback] Video confirmed playing:', video.videoWidth, 'x', video.videoHeight);
              gotTrack = true;
              isConnectedRef.current = true;
              
              setState(prev => ({
                ...prev,
                status: 'playing',
                method: 'webrtc',
                hasVideo: true,
                errorMessage: null,
                connectionQuality: 'good',
              }));
            } else {
              // Check again in 500ms
              setTimeout(checkVideoPlaying, 500);
            }
          };
          
          // Check on loadedmetadata and also with a timeout
          videoRef.current.onloadedmetadata = checkVideoPlaying;
          setTimeout(checkVideoPlaying, 1000);
        } else {
          // Audio track
          gotTrack = true;
          isConnectedRef.current = true;
        }
        
        videoRef.current.play().catch(() => {
          setState(prev => ({ ...prev, showUnmutePrompt: true }));
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log('[CloudflarePlayback] WebRTC state:', s);
      
      if (s === 'connected') {
        setState(prev => ({ ...prev, connectionQuality: 'good' }));
      } else if (s === 'failed' || s === 'disconnected') {
        if (!gotTrack) {
          console.log('[CloudflarePlayback] WebRTC failed, falling back to HLS');
          pc.close();
          connectHLS();
        } else {
          setState(prev => ({ ...prev, connectionQuality: 'poor' }));
        }
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

    // Wait for ICE gathering with extended timeout
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 5000); // Increased from 3000
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp || '',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`WHEP failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Fallback to HLS if no tracks received - extended timeout
      setTimeout(() => {
        if (!gotTrack) {
          console.log('[CloudflarePlayback] No tracks after timeout, falling back to HLS');
          pc.close();
          connectHLS();
        }
      }, 8000); // Increased from 5000
    } catch (error) {
      console.error('[CloudflarePlayback] WHEP error:', error);
      pc.close();
      connectHLS();
    }
  }, [whepUrl, videoRef, updateStatus, connectHLS]);

  // Main connection logic
  const connect = useCallback(() => {
    cleanup();
    retryCountRef.current = 0;

    // If stream not ready, wait and poll more aggressively
    if (!streamReady) {
      console.log('[CloudflarePlayback] Stream not ready, polling...');
      updateStatus('waiting', 'Waiting for host to start streaming...');
      
      // Poll for manifest accessibility every 2 seconds (faster)
      manifestCheckIntervalRef.current = window.setInterval(async () => {
        const accessible = await checkManifestAccessible();
        if (accessible) {
          console.log('[CloudflarePlayback] Manifest now accessible, connecting...');
          if (manifestCheckIntervalRef.current) {
            clearInterval(manifestCheckIntervalRef.current);
            manifestCheckIntervalRef.current = null;
          }
          // Go directly to HLS for better compatibility
          connectHLS();
        }
      }, 2000);
      
      return;
    }

    // Stream is ready - prefer HLS for reliability over WebRTC
    // HLS has better compatibility and the manifest check ensures it works
    if (hlsUrl) {
      console.log('[CloudflarePlayback] Stream ready, using HLS');
      connectHLS();
    } else if (whepUrl && /play|whep/i.test(whepUrl)) {
      console.log('[CloudflarePlayback] No HLS, trying WHEP');
      connectWHEP();
    } else {
      updateStatus('error', 'No stream URL available');
    }
  }, [cleanup, streamReady, whepUrl, hlsUrl, connectWHEP, connectHLS, updateStatus, checkManifestAccessible]);

  // Unmute function
  const unmute = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.muted = false;
      await videoRef.current.play();
      setState(prev => ({ ...prev, showUnmutePrompt: false }));
    } catch (e) {
      console.log('[CloudflarePlayback] Unmute failed:', e);
    }
  }, [videoRef]);

  // Retry function
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Effect to start connection when URLs or readiness changes
  useEffect(() => {
    console.log('[CloudflarePlayback] Effect triggered - hlsUrl:', !!hlsUrl, 'whepUrl:', !!whepUrl, 'streamReady:', streamReady);
    
    if (!hlsUrl && !whepUrl) {
      console.log('[CloudflarePlayback] No URLs provided yet, waiting...');
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }
    
    // If we're already connected and playing, don't reconnect
    if (isConnectedRef.current) {
      console.log('[CloudflarePlayback] Already connected, skipping reconnect');
      return;
    }
    
    connect();
    
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlsUrl, whepUrl, streamReady]); // Intentionally limited deps to avoid reconnect loops

  return {
    ...state,
    unmute,
    retry,
    cleanup,
  };
}
