import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

export type PlaybackStatus = 'idle' | 'waiting' | 'connecting' | 'buffering' | 'playing' | 'error';
export type PlaybackMethod = 'hls' | 'webrtc' | null;

interface UseCloudflarePlaybackProps {
  hlsUrl?: string | null;
  whepUrl?: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamReady?: boolean; // Now ignored - we connect immediately
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
  streamReady = true, // Ignored - we connect immediately regardless
  onStatusChange,
}: UseCloudflarePlaybackProps) {
  const hlsRef = useRef<Hls | null>(null);
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
  const maxRetries = 20; // Even more retries - HLS can take time to become available
  const isConnectedRef = useRef(false);

  // Update status and notify
  const updateStatus = useCallback((status: PlaybackStatus, errorMessage: string | null = null) => {
    setState(prev => ({ ...prev, status, errorMessage }));
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    
    isConnectedRef.current = false;
  }, [videoRef]);

  // INSTANT HLS CONNECTION - No manifest pre-check, just connect!
  const connectHLS = useCallback(() => {
    if (!hlsUrl || !videoRef.current) {
      updateStatus('error', 'No stream URL available');
      return;
    }

    console.log('[Playback] 🚀 Instant HLS connect:', hlsUrl);
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
        manifestLoadingTimeOut: 5000,  // Faster timeout
        manifestLoadingMaxRetry: 10,   // More retries
        manifestLoadingRetryDelay: 1000, // 1 second between retries
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

      // Handle stalling
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
            console.log('[Playback] Video dimensions:', video.videoWidth, 'x', video.videoHeight);
            setState(prev => ({ ...prev, hasVideo: true }));
          }
        };
      }

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('[Playback] HLS error:', data.type, data.details);
        
        if (data.fatal) {
          hls.destroy();
          
          // Quick retry for ALL errors - stream might still be starting
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = 1000; // Even faster retry - 1 second
            console.log(`[Playback] Retry ${retryCountRef.current}/${maxRetries} in ${delay}ms`);
            updateStatus('connecting', 'Connecting to stream...');
            retryTimeoutRef.current = window.setTimeout(connectHLS, delay);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            updateStatus('error', 'Stream unavailable - please try again');
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS - even faster!
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
          updateStatus('waiting', 'Connecting...');
          retryTimeoutRef.current = window.setTimeout(connectHLS, 1500);
        } else {
          updateStatus('error', 'Stream unavailable');
        }
      };
    } else {
      updateStatus('error', 'Browser does not support HLS');
    }
  }, [hlsUrl, videoRef, updateStatus]);

  // Main connection - INSTANT, no waiting
  const connect = useCallback(() => {
    cleanup();
    retryCountRef.current = 0;

    if (!hlsUrl) {
      console.log('[Playback] No HLS URL yet');
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }

    // INSTANT CONNECTION - just try HLS immediately!
    console.log('[Playback] 🎬 Starting instant connection');
    connectHLS();
  }, [cleanup, hlsUrl, connectHLS, updateStatus]);

  // Unmute
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

  // Retry
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Effect to start connection when HLS URL is available - IGNORE streamReady!
  useEffect(() => {
    console.log('[Playback] URL changed - hlsUrl:', !!hlsUrl, '(streamReady ignored for instant connect)');
    
    if (!hlsUrl) {
      updateStatus('waiting', 'Waiting for stream...');
      return;
    }
    
    // If already connected, don't reconnect
    if (isConnectedRef.current) {
      return;
    }
    
    // INSTANT CONNECTION - don't wait for streamReady!
    // HLS.js will automatically retry if manifest isn't ready yet
    connect();
    
    return () => cleanup();
  }, [hlsUrl, connect, cleanup, updateStatus]); // Removed streamReady dependency

  return {
    ...state,
    unmute,
    retry,
    cleanup,
  };
}
