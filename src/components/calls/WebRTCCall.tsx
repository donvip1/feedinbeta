import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor } from 'lucide-react';
import { ConnectionIndicator } from './ConnectionIndicator';

interface WebRTCCallProps {
  callId: string;
  isInitiator: boolean;
  otherUser: { id: string; display_name: string; avatar_url: string };
  isVideo: boolean;
  onEndCall: () => void;
}

export const WebRTCCall = ({ callId, isInitiator, otherUser, isVideo, onEndCall }: WebRTCCallProps) => {
  const {
    localStream,
    remoteStream,
    connectionState,
    isScreenSharing,
    callStats,
    toggleScreenShare,
    cleanup,
  } = useWebRTC({
    callId,
    isInitiator,
    otherUserId: otherUser.id,
    isVideo,
    onConnectionStateChange: (state) => {
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        onEndCall();
      }
    },
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideo);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    return () => {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    };
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    return () => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
  }, [remoteStream]);

  const handleEndCall = useCallback(() => {
    cleanup();
    onEndCall();
  }, [cleanup, onEndCall]);
  
  // Add a listener for the browser's beforeunload event.
  useEffect(() => {
    window.addEventListener("beforeunload", handleEndCall);
    return () => {
      window.removeEventListener("beforeunload", handleEndCall);
    }
  },[handleEndCall]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsMuted((prev) => !prev);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const isEnabling = localStream.getVideoTracks().some(t => !t.enabled)
      localStream.getVideoTracks().forEach((track) => { track.enabled = isEnabling; });
      setIsVideoOff(!isEnabling);
    }
  };
  
  const remoteVideoHasTracks = remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks().some(t => t.enabled);

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col text-white animate-fade-in">
      <div className="flex-1 relative flex items-center justify-center">
        {/* Remote Video / Avatar */}
        {remoteVideoHasTracks ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                <Avatar className="w-32 h-32 border-4 border-gray-600">
                    <AvatarImage src={otherUser.avatar_url} alt={otherUser.display_name} />
                    <AvatarFallback>{otherUser.display_name[0]}</AvatarFallback>
                </Avatar>
                <h2 className="text-3xl font-bold mt-4">{otherUser.display_name}</h2>
                <p className="text-lg text-gray-400 mt-2 capitalize">{connectionState}</p>
            </div>
        )}

        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/30 p-2 rounded-lg">
          <ConnectionIndicator
            connectionState={connectionState}
            latency={callStats?.latency || null}
          />
          <span className="text-sm font-medium">{callStats?.latency ? `${Math.round(callStats.latency)}ms` : ''}</span>
        </div>

        {/* Local Video (PiP) */}
        {localStream && (
            <div className={`absolute bottom-24 md:bottom-28 right-4 w-32 h-48 md:w-40 md:h-56 bg-black rounded-lg overflow-hidden border-2 ${isScreenSharing ? 'border-blue-500' : 'border-gray-700'} transition-all duration-300 shadow-xl`}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1 rounded">
                You
              </div>
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="py-4 bg-gray-900/80 flex items-center justify-center gap-3 md:gap-4">
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="icon"
          className="rounded-full w-14 h-14 bg-white/10 hover:bg-white/20 text-white transition-all"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        {isVideo && (
          <Button
            variant={isVideoOff ? 'destructive' : 'secondary'}
            size="icon"
            className="rounded-full w-14 h-14 bg-white/10 hover:bg-white/20 text-white transition-all"
            onClick={toggleVideo}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </Button>
        )}

        {isVideo && (
          <Button
            variant={isScreenSharing ? 'default' : 'secondary'}
            size="icon"
            className={`rounded-full w-14 h-14 text-white transition-all ${isScreenSharing ? 'bg-blue-600' : 'bg-white/10'} hover:bg-blue-700`}
            onClick={toggleScreenShare}
          >
            <Monitor className="w-6 h-6" />
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          className="rounded-full w-16 h-16 scale-110 shadow-lg mx-2"
          onClick={handleEndCall}
        >
          <PhoneOff className="w-7 h-7" />
        </Button>
      </div>
    </div>
  );
};
