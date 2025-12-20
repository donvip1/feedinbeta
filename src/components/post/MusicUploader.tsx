import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Upload, Play, Pause, Scissors, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface MusicUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (track: {
    id: string;
    title: string;
    artist: string | null;
    audio_url: string;
    duration_seconds: number;
  }) => void;
  targetDuration?: number; // Optional duration to auto-trim to
}

export const MusicUploader: React.FC<MusicUploaderProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  targetDuration,
}) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [audioUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    // Max 50MB
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setFile(selectedFile);
    
    // Extract title from filename
    const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
    setTitle(fileName);

    // Create audio URL
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);

    // Get duration
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      const audioDuration = audio.duration;
      setDuration(audioDuration);
      setTrimEnd(targetDuration ? Math.min(targetDuration, audioDuration) : audioDuration);
      
      // Draw waveform
      drawWaveform(selectedFile);
    });
    audioRef.current = audio;
  };

  const drawWaveform = async (file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 200;
      const blockSize = Math.floor(channelData.length / samples);
      const peaks: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        peaks.push(sum / blockSize);
      }

      const maxPeak = Math.max(...peaks);
      const normalizedPeaks = peaks.map(p => p / maxPeak);

      // Clear and draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = canvas.width / samples;
      const centerY = canvas.height / 2;

      normalizedPeaks.forEach((peak, i) => {
        const height = peak * centerY * 0.8;
        const x = i * barWidth;
        
        // Check if this bar is in the selected range
        const progress = i / samples;
        const startProgress = trimStart / duration;
        const endProgress = trimEnd / duration;
        const isSelected = progress >= startProgress && progress <= endProgress;
        
        ctx.fillStyle = isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)';
        ctx.fillRect(x, centerY - height, barWidth - 1, height * 2);
      });

      audioContext.close();
    } catch (error) {
      console.error('Failed to draw waveform:', error);
    }
  };

  useEffect(() => {
    if (file && duration > 0) {
      drawWaveform(file);
    }
  }, [trimStart, trimEnd, duration, file]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.currentTime = trimStart;
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= trimEnd) {
        audio.pause();
        audio.currentTime = trimStart;
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [trimStart, trimEnd]);

  const handleUpload = async () => {
    if (!file || !user || !title.trim()) {
      toast.error('Please provide a title for the track');
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('music-tracks')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('music-tracks')
        .getPublicUrl(filePath);

      // Create database record
      const { data: track, error: dbError } = await supabase
        .from('music_tracks' as any)
        .insert({
          title: title.trim(),
          artist: artist.trim() || null,
          audio_url: urlData.publicUrl,
          duration_seconds: Math.floor(trimEnd - trimStart),
          source: 'user_upload',
          uploader_id: user.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const trackData = track as any;
      toast.success('Music uploaded successfully!');
      onUploadComplete({
        id: trackData.id,
        title: trackData.title,
        artist: trackData.artist,
        audio_url: trackData.audio_url,
        duration_seconds: trackData.duration_seconds || 0,
      });
      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload music');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setAudioUrl(null);
    setTitle('');
    setArtist('');
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const trimmedDuration = trimEnd - trimStart;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Music
          </DialogTitle>
        </DialogHeader>

        {!file ? (
          <div 
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Click to upload audio</p>
            <p className="text-sm text-muted-foreground mt-1">
              MP3, WAV, M4A up to 50MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title & Artist */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Track title"
                />
              </div>
              <div>
                <Label htmlFor="artist">Artist (optional)</Label>
                <Input
                  id="artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Artist name"
                />
              </div>
            </div>

            {/* Waveform */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Trim Audio
                </Label>
                <span className="text-sm text-muted-foreground">
                  {formatTime(trimmedDuration)}
                </span>
              </div>
              <canvas 
                ref={canvasRef} 
                width={400} 
                height={60}
                className="w-full h-[60px] bg-muted/30 rounded"
              />
            </div>

            {/* Trim controls */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm w-12">Start</span>
                <Slider
                  value={[trimStart]}
                  onValueChange={([val]) => setTrimStart(Math.min(val, trimEnd - 1))}
                  max={duration}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{formatTime(trimStart)}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm w-12">End</span>
                <Slider
                  value={[trimEnd]}
                  onValueChange={([val]) => setTrimEnd(Math.max(val, trimStart + 1))}
                  max={duration}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{formatTime(trimEnd)}</span>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-center">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full w-14 h-14"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={uploading}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={uploading || !title.trim()}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Upload
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
