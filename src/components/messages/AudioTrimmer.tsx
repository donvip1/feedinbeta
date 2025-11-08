import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Scissors, X, Check } from 'lucide-react';

interface AudioTrimmerProps {
  audioUrl: string;
  onTrimComplete: (trimmedBlob: Blob) => void;
  onCancel: () => void;
}

export const AudioTrimmer = ({ audioUrl, onTrimComplete, onCancel }: AudioTrimmerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    loadAudio();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    drawWaveform();
  }, [waveformData, trimStart, trimEnd, currentTime]);

  const loadAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = audioUrl;
    
    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
      setTrimEnd(audio.duration);
      analyzeAudio();
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Stop at trim end
      if (audio.currentTime >= trimEnd) {
        audio.pause();
        setIsPlaying(false);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
    };
  };

  const analyzeAudio = async () => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 100;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      const multiplier = Math.pow(Math.max(...filteredData), -1);
      const normalizedData = filteredData.map(n => n * multiplier);
      
      setWaveformData(normalizedData);
    } catch (error) {
      console.error('Error analyzing audio:', error);
      // Fallback to basic waveform
      setWaveformData(Array(100).fill(0).map(() => Math.random()));
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / waveformData.length;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw waveform bars
    waveformData.forEach((value, index) => {
      const barHeight = value * height * 0.8;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      const time = (index / waveformData.length) * duration;
      const isInTrimRange = time >= trimStart && time <= trimEnd;
      const isCurrentPosition = Math.abs(time - currentTime) < (duration / waveformData.length);
      
      if (isCurrentPosition) {
        ctx.fillStyle = 'hsl(var(--primary))';
      } else if (isInTrimRange) {
        ctx.fillStyle = 'hsl(var(--primary) / 0.6)';
      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground) / 0.3)';
      }
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
    
    // Draw trim markers
    const startX = (trimStart / duration) * width;
    const endX = (trimEnd / duration) * width;
    
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      if (audio.currentTime < trimStart || audio.currentTime >= trimEnd) {
        audio.currentTime = trimStart;
      }
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrimStartChange = (value: number[]) => {
    const newStart = value[0];
    setTrimStart(newStart);
    if (newStart >= trimEnd) {
      setTrimEnd(newStart + 0.1);
    }
  };

  const handleTrimEndChange = (value: number[]) => {
    const newEnd = value[0];
    setTrimEnd(newEnd);
    if (newEnd <= trimStart) {
      setTrimStart(newEnd - 0.1);
    }
  };

  const handleTrim = async () => {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(trimStart * sampleRate);
      const endSample = Math.floor(trimEnd * sampleRate);
      const trimmedLength = endSample - startSample;
      
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        trimmedLength,
        sampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const trimmedData = trimmedBuffer.getChannelData(channel);
        for (let i = 0; i < trimmedLength; i++) {
          trimmedData[i] = sourceData[startSample + i];
        }
      }
      
      // Convert to blob
      const offlineContext = new OfflineAudioContext(
        trimmedBuffer.numberOfChannels,
        trimmedBuffer.length,
        trimmedBuffer.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = trimmedBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      const renderedBuffer = await offlineContext.startRendering();
      const wav = audioBufferToWav(renderedBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      
      onTrimComplete(blob);
    } catch (error) {
      console.error('Error trimming audio:', error);
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const data = new Float32Array(buffer.length * numberOfChannels);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        data[i * numberOfChannels + channel] = channelData[i];
      }
    }
    
    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return arrayBuffer;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-background rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Scissors className="w-5 h-5" />
          Trim Audio
        </h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        className="w-full h-32 bg-accent rounded"
      />

      <audio ref={audioRef} className="hidden" />

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Start: {formatTime(trimStart)}</span>
            <span>End: {formatTime(trimEnd)}</span>
          </div>
          <div className="space-y-2">
            <Slider
              value={[trimStart]}
              onValueChange={handleTrimStartChange}
              max={duration}
              step={0.1}
              className="w-full"
            />
            <Slider
              value={[trimEnd]}
              onValueChange={handleTrimEndChange}
              max={duration}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>Duration: {formatTime(trimEnd - trimStart)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={togglePlayPause}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 mr-2" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          className="flex-1"
          onClick={handleTrim}
        >
          <Check className="w-4 h-4 mr-2" />
          Apply Trim
        </Button>
      </div>
    </div>
  );
};
