import { motion, AnimatePresence } from 'framer-motion';

interface LightFlashOverlayProps {
  isFlashing: boolean;
}

export const LightFlashOverlay = ({ isFlashing }: LightFlashOverlayProps) => {
  return (
    <AnimatePresence>
      {isFlashing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.6, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] bg-white pointer-events-none"
        />
      )}
    </AnimatePresence>
  );
};
