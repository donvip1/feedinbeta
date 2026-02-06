import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCoverDisplayProps {
  coverUrl: string | null | undefined;
  title?: string;
  className?: string;
}

export const EventCoverDisplay = ({ coverUrl, title, className }: EventCoverDisplayProps) => {
  const [showFullImage, setShowFullImage] = useState(false);

  if (!coverUrl) return null;

  return (
    <>
      {/* Small thumbnail in top-left */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setShowFullImage(true)}
        className={cn(
          "w-12 h-12 rounded-lg overflow-hidden",
          "ring-2 ring-white/30 shadow-lg",
          "hover:ring-white/50 transition-all hover:scale-105",
          className
        )}
      >
        <img 
          src={coverUrl} 
          alt={title || 'Event cover'} 
          className="w-full h-full object-cover"
        />
      </motion.button>

      {/* Full image modal */}
      <AnimatePresence>
        {showFullImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullImage(false)}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowFullImage(false)}
                className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={coverUrl} 
                alt={title || 'Event cover'} 
                className="w-full rounded-xl shadow-2xl"
              />
              {title && (
                <p className="text-center text-white mt-4 font-medium">{title}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};