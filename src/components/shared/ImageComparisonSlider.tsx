import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';

interface ImageComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export const ImageComparisonSlider = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className = '',
}: ImageComparisonSliderProps) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
      setSliderPosition(percentage);
    },
    []
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleMove(e.clientX);
  }, [handleMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      handleMove(e.touches[0].clientX);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleMove]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video overflow-hidden rounded-xl cursor-ew-resize select-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Checkered background for transparency */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
            linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
            linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      />

      {/* After Image (Full, underneath) */}
      <img
        src={afterImage}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* Before Image (Clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Slider Line */}
      <motion.div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        animate={{ scale: isDragging ? 1.1 : 1 }}
      >
        {/* Slider Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-primary">
          <GripVertical className="w-5 h-5 text-primary" />
        </div>
      </motion.div>

      {/* Labels */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
        {afterLabel}
      </div>

      {/* Instructions */}
      {!isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 text-white text-xs font-medium rounded-full"
        >
          Drag to compare
        </motion.div>
      )}
    </div>
  );
};

export default ImageComparisonSlider;
