import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CaptureButtonProps {
  onCapture: () => void;
  onRecordStart: () => void;
  onRecordEnd: () => void;
  isRecording: boolean;
  recordProgress?: number; // 0-100
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function CaptureButton({
  onCapture,
  onRecordStart,
  onRecordEnd,
  isRecording,
  recordProgress = 0,
  disabled = false,
  size = 'lg',
}: CaptureButtonProps) {
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const [isPressed, setIsPressed] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };

  const innerSizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const ringSize = {
    sm: 64,
    md: 80,
    lg: 96,
  };

  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy') => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        const style = type === 'light' ? ImpactStyle.Light : type === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy;
        await Haptics.impact({ style });
      } else if (navigator.vibrate) {
        navigator.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
      }
    } catch {}
  }, []);

  const handlePointerDown = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    isHoldingRef.current = true;
    triggerHaptic('light');

    // Start hold timer - if held for 200ms, start recording
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        triggerHaptic('medium');
        onRecordStart();
      }
    }, 200);
  }, [disabled, onRecordStart, triggerHaptic]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    const wasHolding = isHoldingRef.current;
    isHoldingRef.current = false;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isRecording) {
      // Was recording, stop it
      triggerHaptic('medium');
      onRecordEnd();
    } else if (wasHolding) {
      // Quick tap - take photo
      triggerHaptic('heavy');
      onCapture();
    }
  }, [isRecording, onCapture, onRecordEnd, triggerHaptic]);

  const handlePointerLeave = useCallback(() => {
    if (isHoldingRef.current && !isRecording) {
      setIsPressed(false);
      isHoldingRef.current = false;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  // Calculate SVG circle properties for progress ring
  const radius = (ringSize[size] - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (recordProgress / 100) * circumference;

  return (
    <div className={cn('relative', sizeClasses[size])}>
      {/* Progress ring for recording */}
      {isRecording && (
        <svg
          className="absolute inset-0 -rotate-90 z-10"
          width={ringSize[size]}
          height={ringSize[size]}
        >
          {/* Background ring */}
          <circle
            cx={ringSize[size] / 2}
            cy={ringSize[size] / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="4"
          />
          {/* Progress ring */}
          <circle
            cx={ringSize[size] / 2}
            cy={ringSize[size] / 2}
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-100"
          />
        </svg>
      )}

      {/* Outer ring */}
      <div
        className={cn(
          'absolute inset-0 rounded-full border-4 transition-all duration-150',
          isRecording ? 'border-red-500 scale-110' : 'border-white',
          isPressed && !isRecording && 'scale-95',
          disabled && 'opacity-50'
        )}
      />

      {/* Inner button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        disabled={disabled}
        className={cn(
          'absolute inset-0 m-auto rounded-full transition-all duration-150 touch-none select-none',
          innerSizeClasses[size],
          isRecording 
            ? 'bg-red-500 rounded-lg scale-50' 
            : 'bg-white',
          isPressed && !isRecording && 'scale-90 bg-gray-200',
          disabled && 'cursor-not-allowed'
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      />

      {/* Pulse effect when recording */}
      {isRecording && (
        <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-30" />
      )}
    </div>
  );
}
