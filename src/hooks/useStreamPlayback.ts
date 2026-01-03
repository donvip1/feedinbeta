import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { toast } from 'sonner';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';
type PlaybackMethod = 'webrtc' | 'hls' | null;

interface UseStreamPlaybackProps {
  cfHlsUrl?: string | null;
  cfWhepUrl?: string | null; // must be the actual WHEP endpoint (playback), NOT WHIP (publish)
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function useStreamPlayback({ cfHlsUrl, cfWhepUrl, videoRef }: UseStreamPlaybackProps) {
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [method, setMethod] = useState<PlaybackMethod>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(true);

  const clearTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  const cleanup = useCallback(() => {
    clearTimers();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicegatheringstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const connectHLS = useCallback(() => {
    console.log('[StreamPlayback] Connecting via HLS:', cfHlsUrl);
    cleanup();
    
    if (!cfHlsUrl || !videoRef.current) {
      console.warn('[StreamPlayback] No HLS URL or video element');
      setStatus('failed');
      setHasVideo(false);
      setMethod(null);
      return;
    }

    setStatus('connecting');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 15,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
        fragLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });

      hls.loadSource(cfHlsUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[StreamPlayback] HLS manifest parsed, starting playback');
        setHasVideo(true);
        setStatus('connected');
        setMethod('hls');
        toast.success('Connected to stream');
        videoRef.current?.play().catch(() => setShowUnmutePrompt(true));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[StreamPlayback] HLS error:', data);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.log('[StreamPlayback] HLS network error, retrying...');
            const t = window.setTimeout(() => hls.startLoad(), 1000);
            timersRef.current.push(t);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('[StreamPlayback] HLS media error, recovering...');
            hls.recoverMediaError();
          } else {
            console.error('[StreamPlayback] Fatal HLS error');
            setStatus('failed');
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      console.log('[StreamPlayback] Using Safari native HLS');
      videoRef.current.src = cfHlsUrl;
      
      const onLoaded = () => {
        console.log('[StreamPlayback] Safari HLS loaded');
        setHasVideo(true);
        setStatus('connected');
        setMethod('hls');
        videoRef.current?.play().catch(() => setShowUnmutePrompt(true));
      };
      
      const onError = () => {
        console.error('[StreamPlayback] Safari HLS error');
        setStatus('failed');
      };
      
      videoRef.current.addEventListener('loadedmetadata', onLoaded, { once: true });
      videoRef.current.addEventListener('error', onError, { once: true });
    } else {
      console.error('[StreamPlayback] HLS not supported');
      setStatus('failed');
    }
  }, [cfHlsUrl, videoRef, cleanup]);

  const connectWHEP = useCallback(async () => {
    // Validate WHEP URL - must be a playback URL, not publish
    if (!cfWhepUrl || !videoRef.current) {
      console.log('[StreamPlayback] No WHEP URL, using HLS');
      connectHLS();
      return;
    }

    // Check if this is actually a WHEP (playback) URL, not WHIP (publish)
    const isPlaybackUrl = /play|whep/i.test(cfWhepUrl) && !/publish|whip/i.test(cfWhepUrl);
    if (!isPlaybackUrl) {
      console.warn('[StreamPlayback] URL appears to be publish URL, not playback. Using HLS instead.');
      console.warn('[StreamPlayback] cfWhepUrl:', cfWhepUrl);
      connectHLS();
      return;
    }

    console.log('[StreamPlayback] Connecting via WHEP:', cfWhepUrl);
    cleanup();
    setStatus('connecting');

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
    pcRef.current = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    let gotTrack = false;

    pc.ontrack = (event) => {
      console.log('[StreamPlayback] Got track:', event.track.kind);
      if (event.streams[0] && videoRef.current) {
        gotTrack = true;
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => setShowUnmutePrompt(true));
        setHasVideo(true);
        setStatus('connected');
        setMethod('webrtc');
        toast.success('Connected via WebRTC (low latency)');
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log('[StreamPlayback] WebRTC connection state:', s);
      if ((s === 'failed' || s === 'disconnected') && !gotTrack) {
        console.log('[StreamPlayback] WebRTC failed, falling back to HLS');
        connectHLS();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const t = window.setTimeout(resolve, 3000);
        timersRef.current.push(t);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') resolve();
        };
      });

      abortRef.current = new AbortController();

      const res = await fetch(cfWhepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp || '',
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`WHEP failed: ${res.status}`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Wait for tracks or fall back
      const trackWait = window.setTimeout(() => {
        if (!gotTrack) {
          console.log('[StreamPlayback] No tracks received, falling back to HLS');
          connectHLS();
        }
      }, 5000);
      timersRef.current.push(trackWait);
    } catch (err: any) {
      console.error('[StreamPlayback] WHEP error:', err?.message || err);
      connectHLS();
    }
  }, [cfWhepUrl, videoRef, cleanup, connectHLS]);

  useEffect(() => {
    console.log('[StreamPlayback] Starting playback. HLS:', cfHlsUrl, 'WHEP:', cfWhepUrl);
    
    // Prioritize HLS for reliability - only try WebRTC if we have a valid WHEP playback URL
    const hasValidWhepUrl = cfWhepUrl && /play|whep/i.test(cfWhepUrl) && !/publish|whip/i.test(cfWhepUrl);
    
    if (hasValidWhepUrl) {
      console.log('[StreamPlayback] Valid WHEP URL found, trying WebRTC first');
      connectWHEP();
    } else if (cfHlsUrl) {
      console.log('[StreamPlayback] Using HLS (no valid WHEP URL)');
      connectHLS();
    } else {
      console.warn('[StreamPlayback] No playback URLs available');
      setStatus('failed');
    }

    return () => cleanup();
  }, [cfWhepUrl, cfHlsUrl, connectWHEP, connectHLS, cleanup]);

  const unmute = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.muted = false;
      await videoRef.current.play();
      setShowUnmutePrompt(false);
    } catch {
      // keep prompt visible
    }
  }, [videoRef]);

  return {
    status,
    method,
    hasVideo,
    showUnmutePrompt,
    unmute,
    cleanup,
  };
}
