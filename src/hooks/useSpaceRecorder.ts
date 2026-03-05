import { useRef, useState, useCallback } from 'react';
import { Room, Track, RemoteParticipant } from 'livekit-client';

interface UseSpaceRecorderReturn {
  isRecording: boolean;
  startRecording: (room: Room) => void;
  stopRecording: () => Promise<Blob | null>;
}

export const useSpaceRecorder = (): UseSpaceRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sourceNodesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const chunksRef = useRef<Blob[]>([]);
  const roomRef = useRef<Room | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const addTrackSource = useCallback((mediaStreamTrack: MediaStreamTrack, id: string) => {
    const ctx = audioContextRef.current;
    const dest = destinationRef.current;
    if (!ctx || !dest) return;

    // Remove existing source for this id
    const existing = sourceNodesRef.current.get(id);
    if (existing) {
      try { existing.disconnect(); } catch {}
      sourceNodesRef.current.delete(id);
    }

    try {
      const stream = new MediaStream([mediaStreamTrack]);
      const source = ctx.createMediaStreamSource(stream);
      source.connect(dest);
      sourceNodesRef.current.set(id, source);
      console.log(`[SpaceRecorder] Added audio source: ${id}`);
    } catch (e) {
      console.warn(`[SpaceRecorder] Failed to add source ${id}:`, e);
    }
  }, []);

  const removeTrackSource = useCallback((id: string) => {
    const node = sourceNodesRef.current.get(id);
    if (node) {
      try { node.disconnect(); } catch {}
      sourceNodesRef.current.delete(id);
      console.log(`[SpaceRecorder] Removed audio source: ${id}`);
    }
  }, []);

  const startRecording = useCallback((room: Room) => {
    if (mediaRecorderRef.current) {
      console.log('[SpaceRecorder] Already recording');
      return;
    }

    console.log('[SpaceRecorder] Starting client-side recording...');
    roomRef.current = room;
    chunksRef.current = [];

    // Create AudioContext and destination
    const audioContext = new AudioContext({ sampleRate: 48000 });
    audioContextRef.current = audioContext;
    const destination = audioContext.createMediaStreamDestination();
    destinationRef.current = destination;

    // Add local participant's audio track
    const localPub = room.localParticipant.audioTrackPublications.values();
    for (const pub of localPub) {
      if (pub.track?.mediaStreamTrack) {
        addTrackSource(pub.track.mediaStreamTrack, 'local');
      }
    }

    // Add all remote participants' audio tracks
    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          addTrackSource(pub.track.mediaStreamTrack, participant.identity);
        }
      });
    });

    // Listen for new tracks being subscribed
    const onTrackSubscribed = (track: any, _pub: any, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio && track.mediaStreamTrack) {
        addTrackSource(track.mediaStreamTrack, participant.identity);
      }
    };

    const onTrackUnsubscribed = (_track: any, _pub: any, participant: RemoteParticipant) => {
      removeTrackSource(participant.identity);
    };

    room.on('trackSubscribed' as any, onTrackSubscribed);
    room.on('trackUnsubscribed' as any, onTrackUnsubscribed);

    // Determine supported mimeType
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(destination.stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      console.log(`[SpaceRecorder] Recorder stopped, ${chunksRef.current.length} chunks`);
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // Cleanup
      room.off('trackSubscribed' as any, onTrackSubscribed);
      room.off('trackUnsubscribed' as any, onTrackUnsubscribed);
      sourceNodesRef.current.forEach((node) => { try { node.disconnect(); } catch {} });
      sourceNodesRef.current.clear();
      try { audioContext.close(); } catch {}
      audioContextRef.current = null;
      destinationRef.current = null;
      mediaRecorderRef.current = null;

      if (resolveStopRef.current) {
        resolveStopRef.current(blob.size > 0 ? blob : null);
        resolveStopRef.current = null;
      }
    };

    recorder.start(1000); // Collect data every second
    setIsRecording(true);
    console.log('[SpaceRecorder] ✅ Recording started');
  }, [addTrackSource, removeTrackSource]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        console.log('[SpaceRecorder] No active recording to stop');
        setIsRecording(false);
        resolve(null);
        return;
      }

      console.log('[SpaceRecorder] Stopping recording...');
      resolveStopRef.current = resolve;
      setIsRecording(false);
      recorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
};
