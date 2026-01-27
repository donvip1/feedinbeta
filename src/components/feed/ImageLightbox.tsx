import { useCallback, useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface ImageLightboxProps {
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export default function ImageLightbox({ images, activeIndex, onClose, onNavigate }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(activeIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state with prop
  useEffect(() => {
    setCurrentIndex(activeIndex);
  }, [activeIndex]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const navigatePrev = useCallback(() => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  const navigateNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  // Swipe handling
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(velocity) > 300 || Math.abs(offset) > threshold) {
      if (offset > 0 || velocity > 300) {
        navigatePrev();
      } else {
        navigateNext();
      }
    }
  }, [navigatePrev, navigateNext]);

  // Vertical swipe to close
  const handleVerticalDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  }, [onClose]);

  if (activeIndex === null || images.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigatePrev();
              }}
              className="absolute left-4 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateNext();
              }}
              className="absolute right-4 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Image Container */}
        <motion.div
          ref={containerRef}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-full flex items-center justify-center p-4"
        >
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`Image ${currentIndex + 1}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={handleVerticalDrag}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
          />
        </motion.div>

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-full text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* Thumbnail Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                  onNavigate?.(idx);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  idx === currentIndex
                    ? "bg-white w-4"
                    : "bg-white/40 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
