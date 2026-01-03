import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { toast } from 'sonner';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';
type PlaybackMethod = 'webrtc' | 'hls' | null;

interface UseStreamPlaybackProps {
  cfHlsUrl?: string;
  cfWhepUrl?: string; // must be the actual WHEP endpoint
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

  const forceHLS = useCallback(() => {
    cleanup();
    if (!cfHlsUrl || !videoRef.current) {
      setStatus('connected'); // keep UI usable
      setHasVideo(false);
      setMethod(null);
      return;
    }

    console.log('[useStreamPlayback] Forcing HLS connection:', cfHlsUrl);

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
        console.log('[useStreamPlayback] HLS manifest parsed');
        setHasVideo(true);
        setStatus('connected');
        setMethod('hls');
        toast.success('Connected to stream (HLS)');
        videoRef.current?.play().catch(() => setShowUnmutePrompt(true));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[useStreamPlayback] HLS error:', data);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const t = window.setTimeout(() => hls.startLoad(), 1000);
            timersRef.current.push(t);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setStatus('failed');
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      console.log('[useStreamPlayback] Using Safari native HLS');
      videoRef.current.src = cfHlsUrl;
      const onLoaded = () => {
        setHasVideo(true);
        setStatus('connected');
        setMethod('hls');
        videoRef.current?.play().catch(() => setShowUnmutePrompt(true));
      };
      const onError = () => setStatus('failed');
      videoRef.current.addEventListener('loadedmetadata', onLoaded, { once: true });
      videoRef.current.addEventListener('error', onError, { once: true });
    } else {
      setStatus('failed');
    }
  }, [cfHlsUrl, videoRef, cleanup]);

  const connectWHEP = useCallback(async () => {
    cleanup();
    if (!cfWhepUrl || !videoRef.current) {
      forceHLS();
      return;
    }

    // Basic WHEP URL sanity check
    const isLikelyWHEP = /webrtc|whep/i.test(cfWhepUrl);
    if (!isLikelyWHEP) {
      console.log('[useStreamPlayback] URL does not look like WHEP, falling back to HLS');
      forceHLS();
      return;
    }

    console.log('[useStreamPlayback] Connecting via WHEP:', cfWhepUrl);
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
      console.log('[useStreamPlayback] Received track:', event.track.kind);
      if (event.streams[0] && videoRef.current) {
        gotTrack = true;
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.muted = true; // allow autoplay
        videoRef.current.play().catch(() => setShowUnmutePrompt(true));
        setHasVideo(true);
        setStatus('connected');
        setMethod('webrtc');
        toast.success('Connected via WebRTC');
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log('[useStreamPlayback] WebRTC connection state:', s);
      if ((s === 'failed' || s === 'disconnected') && !gotTrack) {
        forceHLS();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (longer timeout)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const t = window.setTimeout(resolve, 4000);
        timersRef.current.push(t);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          }
        };
      });

      // POST SDP to WHEP endpoint with abort + single retry
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const doFetch = async (attempt = 1): Promise<string> => {
        const res = await fetch(cfWhepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription?.sdp || '',
          signal,
        });
        if (!res.ok) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 500));
            return doFetch(attempt + 1);
          }
          throw new Error(`WHEP failed: ${res.status}`);
        }
        return res.text();
      };

      const answerSdp = await doFetch();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      console.log('[useStreamPlayback] WHEP SDP exchange complete');

      // Wait up to 6s for tracks before falling back
      const trackWait = window.setTimeout(() => {
        if (!gotTrack) {
          console.log('[useStreamPlayback] No tracks received, falling back to HLS');
          forceHLS();
        }
      }, 6000);
      timersRef.current.push(trackWait);
    } catch (err: any) {
      console.error('[useStreamPlayback] WHEP Error:', err?.message || err);
      forceHLS();
    }
  }, [cfWhepUrl, videoRef, cleanup, forceHLS]);

  useEffect(() => {
    // Prefer WHEP if present, else HLS
    if (cfWhepUrl) {
      connectWHEP();
    } else {
      forceHLS();
    }

    // Hard fallback after 8s if still not connected
    const hardFallback = window.setTimeout(() => {
      if (status !== 'connected') {
        console.log('[useStreamPlayback] Hard fallback after 8s');
        forceHLS();
      }
    }, 8000);
    timersRef.current.push(hardFallback);

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfWhepUrl, cfHlsUrl]);

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
