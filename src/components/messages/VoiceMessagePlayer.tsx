import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
}

const PLAYBACK_RATES = [1, 1.5, 2];

export const VoiceMessagePlayer = ({ audioUrl, duration = 0 }: VoiceMessagePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [waveformData, setWaveformData] = useState<number[]>(Array(40).fill(0.3));
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    // Set up audio context for waveform visualization
    const setupAudioContext = async () => {
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaElementSource(audio);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    };

    setupAudioContext();

    return () => {
      audio.pause();
      audio.src = '';
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (isPlaying) {
      visualizeWaveform();
    }
  }, [isPlaying]);

  const visualizeWaveform = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || !isPlaying) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const samples = 40;
      const step = Math.floor(bufferLength / samples);
      const newWaveformData: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        newWaveformData.push(Math.max(0.1, dataArray[i * step] / 255));
      }
      
      setWaveformData(newWaveformData);
      
      if (isPlaying) {
        requestAnimationFrame(draw);
      }
    };

    draw();
  };

  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    setPlaybackRate(PLAYBACK_RATES[nextIndex]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 max-w-xs">
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlayPause}
          className="h-10 w-10 shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>

        {/* Waveform with Progress */}
        <div className="flex-1 relative">
          <div className="flex items-center gap-1 h-8">
            {waveformData.map((value, index) => {
              const isPlayed = (index / waveformData.length) * 100 < progress;
              return (
                <div
                  key={index}
                  className="flex-1 rounded-full transition-all duration-100"
                  style={{
                    height: `${value * 100}%`,
                    backgroundColor: isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    opacity: isPlayed ? 1 : 0.3,
                  }}
                />
              );
            })}
          </div>
          
          {/* Progress Slider */}
          <Slider
            value={[currentTime]}
            max={audioDuration}
            step={0.1}
            onValueChange={handleSeek}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        {/* Playback Speed */}
        <Button
          variant="ghost"
          size="sm"
          onClick={cyclePlaybackRate}
          className="h-10 w-12 text-xs font-medium shrink-0"
        >
          {playbackRate}x
        </Button>
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-xs text-muted-foreground px-10">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(audioDuration)}</span>
      </div>
    </div>
  );
};
