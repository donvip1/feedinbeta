import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
  type?: 'slide' | 'fade' | 'scale' | 'slideUp' | 'slideHorizontal';
}

// Spring physics for natural iOS/Android-like feel
const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};

const easeTransition = {
  type: 'tween' as const,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
  duration: 0.35,
};

const variants: Record<string, Variants> = {
  slide: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-30%', opacity: 0 },
  },
  slideHorizontal: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  scale: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
  },
};

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'slide',
}) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants[type]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={type === 'slideUp' ? easeTransition : springTransition}
        className="min-h-screen w-full"
        style={{ 
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Modal/Sheet transition wrapper
interface ModalTransitionProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  type?: 'slideUp' | 'fade' | 'scale';
}

export const ModalTransition: React.FC<ModalTransitionProps> = ({
  children,
  isOpen,
  onClose,
  type = 'slideUp',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Content */}
          <motion.div
            variants={variants[type]}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={easeTransition}
            className="fixed inset-x-0 bottom-0 z-50"
            style={{ 
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Shared element transition hook for TikTok-like image/video transitions
interface SharedElementState {
  id: string;
  rect: DOMRect;
  element: HTMLElement;
}

const sharedElementRegistry = new Map<string, SharedElementState>();

export const useSharedElement = (id: string) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const registerElement = (element: HTMLElement | null) => {
    if (element) {
      sharedElementRegistry.set(id, {
        id,
        rect: element.getBoundingClientRect(),
        element,
      });
    }
  };

  const startTransition = () => {
    setIsTransitioning(true);
    return sharedElementRegistry.get(id);
  };

  const endTransition = () => {
    setIsTransitioning(false);
  };

  return {
    registerElement,
    startTransition,
    endTransition,
    isTransitioning,
  };
};

// List item stagger animation
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className,
  staggerDelay = 0.05,
}) => {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 30, mass: 1 }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
