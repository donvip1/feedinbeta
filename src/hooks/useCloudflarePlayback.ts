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
  const maxRetries = 15;
  const isConnectedRef = useRef(false);

  const updateStatus = useCallback((status: PlaybackStatus, errorMessage: string | null = null) => {
    setState(prev => ({ ...prev, status, errorMessage }));
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Cleanup all connections
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
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
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        bundlePolicy: 'max-bundle',
      });
      whepPcRef.current = pc;

      // Add transceivers for receiving
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('[Playback] ✅ WHEP received track:', event.track.kind);
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

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          };
          pc.onicegatheringstatechange = checkState;
          setTimeout(resolve, 3000);
        }
      });

      const localDesc = pc.localDescription;
      if (!localDesc) {
        throw new Error('No local description');
      }

      // Send offer to WHEP endpoint
      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: localDesc.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Wait for track to arrive
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WHEP timeout')), 5000);
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

  // HLS Connection (reliable fallback)
  const connectHLS = useCallback(() => {
    if (!hlsUrl || !videoRef.current) {
      updateStatus('error', 'No stream URL available');
      return;
    }

    console.log('[Playback] 🎬 Connecting HLS:', hlsUrl);
    updateStatus('connecting');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 5,
        maxBufferLength: 15,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
        fragLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 8,
        manifestLoadingRetryDelay: 1500,
        levelLoadingTimeOut: 8000,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxLoadingDelay: 2,
        maxBufferHole: 0.3,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[Playback] ✅ HLS manifest parsed - PLAYING');
        retryCountRef.current = 0;
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
        console.warn('[Playback] HLS error:', data.type, data.details);
        
        if (data.fatal) {
          hls.destroy();
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = Math.min(1500 * Math.pow(1.3, retryCountRef.current - 1), 8000);
            console.log(`[Playback] Retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`);
            updateStatus('connecting', 'Connecting to stream...');
            retryTimeoutRef.current = window.setTimeout(connectHLS, delay);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            updateStatus('error', 'Stream unavailable - broadcaster may not be live yet');
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
          updateStatus('connecting', 'Connecting...');
          retryTimeoutRef.current = window.setTimeout(connectHLS, 2000);
        } else {
          updateStatus('error', 'Stream unavailable');
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

    if (!hlsUrl && !whepUrl) {
      console.log('[Playback] No URLs available yet');
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }

    updateStatus('connecting', 'Connecting to stream...');

    // Try WHEP first for lowest latency
    if (whepUrl) {
      const whepSuccess = await connectWHEP();
      if (whepSuccess) {
        console.log('[Playback] Using WHEP (WebRTC) playback');
        return;
      }
    }

    // Fall back to HLS
    if (hlsUrl) {
      console.log('[Playback] Falling back to HLS');
      connectHLS();
    } else {
      updateStatus('error', 'No playback URL available');
    }
  }, [cleanup, hlsUrl, whepUrl, connectWHEP, connectHLS, updateStatus]);

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

  // Retry function
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Effect to start connection when URLs change
  useEffect(() => {
    console.log('[Playback] URLs changed - hlsUrl:', !!hlsUrl, 'whepUrl:', !!whepUrl);
    
    if (!hlsUrl && !whepUrl) {
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }
    
    if (isConnectedRef.current) {
      return;
    }
    
    connect();
    
    return () => cleanup();
  }, [hlsUrl, whepUrl, connect, cleanup, updateStatus]);

  return {
    ...state,
    unmute,
    retry,
    cleanup,
  };
}
