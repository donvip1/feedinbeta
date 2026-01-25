import { useCallback, useRef, useState } from 'react';

interface LongPressOptions {
  threshold?: number; // Time in ms to trigger long press
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
}

interface LongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Hook for detecting long press gestures (WhatsApp-style)
 * Default threshold is 500ms
 */
export function useLongPress({
  threshold = 500,
  onLongPress,
  onClick,
}: LongPressOptions): LongPressHandlers {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false;
      
      // Store starting position
      if ('touches' in e) {
        startPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        startPosRef.current = {
          x: e.clientX,
          y: e.clientY,
        };
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress(e);
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // Only trigger click if it wasn't a long press
      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick(e);
      }
    },
    [onClick]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
  };
}
