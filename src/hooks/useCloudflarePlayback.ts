import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

export type PlaybackStatus = 'idle' | 'waiting' | 'connecting' | 'buffering' | 'playing' | 'error';
export type PlaybackMethod = 'hls' | 'whep' | null;

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
  const whepPcRef = useRef<RTCPeerConnection | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const autoRetryIntervalRef = useRef<number | null>(null);
  
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
  const maxRetries = 20; // Increased retries
  const isConnectedRef = useRef(false);
  const lastAttemptRef = useRef(0);

  const updateStatus = useCallback((status: PlaybackStatus, errorMessage: string | null = null) => {
    setState(prev => ({ ...prev, status, errorMessage }));
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Cleanup all connections
  const cleanup = useCallback(() => {
    console.log('[Playback] Cleaning up connections...');
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (autoRetryIntervalRef.current) {
      clearInterval(autoRetryIntervalRef.current);
      autoRetryIntervalRef.current = null;
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (whepPcRef.current) {
      whepPcRef.current.close();
      whepPcRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    
    isConnectedRef.current = false;
  }, [videoRef]);

  // WHEP Connection (WebRTC playback - lowest latency)
  const connectWHEP = useCallback(async (): Promise<boolean> => {
    if (!whepUrl || !videoRef.current) {
      console.log('[Playback] No WHEP URL, skipping');
      return false;
    }

    console.log('[Playback] 🎯 Attempting WHEP connection:', whepUrl);
    
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
        bundlePolicy: 'max-bundle',
      });
      whepPcRef.current = pc;

      // Add transceivers for receiving
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Track received flag
      let trackReceived = false;

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('[Playback] ✅ WHEP received track:', event.track.kind);
        trackReceived = true;
        
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          isConnectedRef.current = true;
          setState(prev => ({
            ...prev,
            status: 'playing',
            method: 'whep',
            hasVideo: true,
            errorMessage: null,
            connectionQuality: 'good',
          }));
          videoRef.current.play().catch(() => {
            setState(prev => ({ ...prev, showUnmutePrompt: true }));
          });
        }
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('[Playback] WHEP connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('[Playback] WHEP connection failed/disconnected');
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering with timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 2000);
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        }
      });

      const localDesc = pc.localDescription;
      if (!localDesc) {
        throw new Error('No local description');
      }

      // Send offer to WHEP endpoint with timeout
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: localDesc.sdp,
        signal: controller.signal,
      });
      
      clearTimeout(fetchTimeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[Playback] WHEP response error:', response.status, errorText);
        throw new Error(`WHEP failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Wait for track to arrive with extended timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (trackReceived) resolve();
          else reject(new Error('WHEP timeout waiting for track'));
        }, 8000);
        
        const checkTrack = setInterval(() => {
          if (isConnectedRef.current) {
            clearTimeout(timeout);
            clearInterval(checkTrack);
            resolve();
          }
        }, 100);
      });

      console.log('[Playback] ✅ WHEP connected successfully');
      return true;
    } catch (error) {
      console.log('[Playback] WHEP failed:', error);
      if (whepPcRef.current) {
        whepPcRef.current.close();
        whepPcRef.current = null;
      }
      return false;
    }
  }, [whepUrl, videoRef]);

  // HLS Connection with aggressive retry
  const connectHLS = useCallback(() => {
    if (!hlsUrl || !videoRef.current) {
      console.log('[Playback] No HLS URL available');
      updateStatus('error', 'No stream URL available');
      return;
    }

    console.log('[Playback] 🎬 Connecting HLS:', hlsUrl, 'attempt:', retryCountRef.current + 1);
    updateStatus('connecting', 'Connecting to stream...');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 3,
        maxBufferLength: 10,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        fragLoadingTimeOut: 15000,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 12000,
        levelLoadingMaxRetry: 8,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxLoadingDelay: 3,
        maxBufferHole: 0.5,
        // Aggressive recovery settings
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 500,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[Playback] ✅ HLS manifest parsed - PLAYING');
        retryCountRef.current = 0;
        isConnectedRef.current = true;
        
        // Clear auto-retry interval on success
        if (autoRetryIntervalRef.current) {
          clearInterval(autoRetryIntervalRef.current);
          autoRetryIntervalRef.current = null;
        }
        
        setState(prev => ({
          ...prev,
          status: 'playing',
          method: 'hls',
          hasVideo: true,
          errorMessage: null,
          connectionQuality: 'good',
        }));
        
        videoRef.current?.play().catch(() => {
          setState(prev => ({ ...prev, showUnmutePrompt: true }));
        });
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setState(prev => ({ ...prev, isBuffering: false }));
      });

      if (videoRef.current) {
        videoRef.current.onwaiting = () => {
          setState(prev => ({ ...prev, isBuffering: true, status: 'buffering' }));
        };
        videoRef.current.onplaying = () => {
          setState(prev => ({ ...prev, isBuffering: false, status: 'playing' }));
        };
        videoRef.current.onloadeddata = () => {
          const video = videoRef.current;
          if (video && video.videoWidth > 0) {
            setState(prev => ({ ...prev, hasVideo: true }));
          }
        };
      }

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('[Playback] HLS error:', data.type, data.details, data.fatal);
        
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          
          const timeSinceLastAttempt = Date.now() - lastAttemptRef.current;
          const minRetryDelay = 1000;
          
          if (retryCountRef.current < maxRetries && timeSinceLastAttempt >= minRetryDelay) {
            retryCountRef.current++;
            lastAttemptRef.current = Date.now();
            
            // Use exponential backoff with jitter
            const baseDelay = Math.min(1500 * Math.pow(1.2, retryCountRef.current - 1), 6000);
            const jitter = Math.random() * 500;
            const delay = baseDelay + jitter;
            
            console.log(`[Playback] Retry ${retryCountRef.current}/${maxRetries} in ${Math.round(delay)}ms`);
            updateStatus('connecting', `Connecting... (attempt ${retryCountRef.current})`);
            retryTimeoutRef.current = window.setTimeout(connectHLS, delay);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('[Playback] Attempting media error recovery...');
            const newHls = new Hls();
            newHls.loadSource(hlsUrl);
            newHls.attachMedia(videoRef.current!);
            hlsRef.current = newHls;
          } else {
            updateStatus('waiting', 'Waiting for broadcaster to start streaming...');
            
            // Set up auto-retry interval for when stream becomes available
            if (!autoRetryIntervalRef.current) {
              console.log('[Playback] Setting up auto-retry every 5s');
              autoRetryIntervalRef.current = window.setInterval(() => {
                if (!isConnectedRef.current && hlsUrl) {
                  console.log('[Playback] Auto-retrying HLS connection...');
                  retryCountRef.current = 0;
                  connectHLS();
                }
              }, 5000);
            }
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      console.log('[Playback] 🍎 Safari native HLS');
      videoRef.current.src = hlsUrl;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('[Playback] ✅ Safari HLS loaded');
        isConnectedRef.current = true;
        setState(prev => ({
          ...prev,
          status: 'playing',
          method: 'hls',
          hasVideo: true,
          errorMessage: null,
          connectionQuality: 'good',
        }));
        videoRef.current?.play().catch(() => {
          setState(prev => ({ ...prev, showUnmutePrompt: true }));
        });
      };
      
      videoRef.current.onerror = () => {
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          updateStatus('connecting', `Connecting... (attempt ${retryCountRef.current})`);
          retryTimeoutRef.current = window.setTimeout(connectHLS, 2000);
        } else {
          updateStatus('waiting', 'Waiting for broadcaster...');
        }
      };
    } else {
      updateStatus('error', 'Browser does not support HLS');
    }
  }, [hlsUrl, videoRef, updateStatus]);

  // Main connection logic - try WHEP first, fall back to HLS
  const connect = useCallback(async () => {
    cleanup();
    retryCountRef.current = 0;
    lastAttemptRef.current = Date.now();

    if (!hlsUrl && !whepUrl) {
      console.log('[Playback] No URLs available yet, waiting...');
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }

    updateStatus('connecting', 'Connecting to stream...');

    // Try WHEP first for lowest latency (only if stream is ready)
    if (whepUrl && streamReady) {
      const whepSuccess = await connectWHEP();
      if (whepSuccess) {
        console.log('[Playback] Using WHEP (WebRTC) playback - ultra low latency');
        return;
      }
    }

    // Fall back to HLS
    if (hlsUrl) {
      console.log('[Playback] Using HLS playback');
      connectHLS();
    } else {
      updateStatus('waiting', 'Waiting for stream URL...');
    }
  }, [cleanup, hlsUrl, whepUrl, streamReady, connectWHEP, connectHLS, updateStatus]);

  // Unmute function
  const unmute = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.muted = false;
      await videoRef.current.play();
      setState(prev => ({ ...prev, showUnmutePrompt: false }));
    } catch (e) {
      console.log('[Playback] Unmute failed:', e);
    }
  }, [videoRef]);

  // Retry function - resets everything and tries again
  const retry = useCallback(() => {
    console.log('[Playback] Manual retry triggered');
    retryCountRef.current = 0;
    isConnectedRef.current = false;
    connect();
  }, [connect]);

  // Effect to start connection when URLs change
  useEffect(() => {
    console.log('[Playback] URLs changed - hlsUrl:', !!hlsUrl, 'whepUrl:', !!whepUrl, 'streamReady:', streamReady);
    
    if (!hlsUrl && !whepUrl) {
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }
    
    // If already connected, don't reconnect unless stream became ready
    if (isConnectedRef.current && state.status === 'playing') {
      console.log('[Playback] Already connected, skipping reconnect');
      return;
    }
    
    connect();
    
    return () => cleanup();
  }, [hlsUrl, whepUrl, streamReady]);

  // Auto-retry when stream becomes ready
  useEffect(() => {
    if (streamReady && (state.status === 'waiting' || state.status === 'error')) {
      console.log('[Playback] Stream became ready, triggering connection...');
      retry();
    }
  }, [streamReady]);

  return {
    ...state,
    unmute,
    retry,
    cleanup,
  };
}
