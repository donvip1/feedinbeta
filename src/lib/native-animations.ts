// Native-optimized animation utilities for 60fps performance

// Spring configurations for natural feel
export const springConfigs = {
  // iOS-like spring
  ios: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 1,
  },
  // Snappy for quick interactions
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 35,
    mass: 0.8,
  },
  // Bouncy for playful animations
  bouncy: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 15,
    mass: 1,
  },
  // Gentle for subtle movements
  gentle: {
    type: 'spring' as const,
    stiffness: 150,
    damping: 25,
    mass: 1.2,
  },
  // Stiff for quick, responsive feedback
  stiff: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 40,
    mass: 0.5,
  },
};

// Easing curves matching native platforms
export const easingCurves = {
  // iOS standard curve
  ios: [0.25, 0.1, 0.25, 1] as const,
  // Material Design standard
  material: [0.4, 0, 0.2, 1] as const,
  // Decelerate (for entering)
  decelerate: [0, 0, 0.2, 1] as const,
  // Accelerate (for exiting)
  accelerate: [0.4, 0, 1, 1] as const,
  // Sharp (for changing state)
  sharp: [0.4, 0, 0.6, 1] as const,
  // Emphasized decelerate
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1] as const,
  // Emphasized accelerate
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15] as const,
};

// Duration presets
export const durations = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
};

// Animation variants for common patterns
export const animationVariants = {
  // Fade
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  
  // Scale
  scaleIn: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
  },
  
  // Slide from bottom (sheets, modals)
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
  
  // Slide from right (pages)
  slideFromRight: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-30%', opacity: 0 },
  },
  
  // Slide from left
  slideFromLeft: {
    initial: { x: '-100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '30%', opacity: 0 },
  },
  
  // Pop (for buttons, icons)
  pop: {
    initial: { scale: 0 },
    animate: { scale: 1 },
    exit: { scale: 0 },
  },
  
  // Bounce in
  bounceIn: {
    initial: { scale: 0.3, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 15,
      },
    },
    exit: { scale: 0.3, opacity: 0 },
  },
};

// Gesture velocity to animation velocity conversion
export const velocityToAnimation = (velocity: number, distance: number): number => {
  // Clamp velocity and convert to reasonable animation duration
  const clampedVelocity = Math.min(Math.abs(velocity), 2000);
  const baseDuration = 0.3;
  const velocityFactor = clampedVelocity / 1000;
  return Math.max(0.1, baseDuration - velocityFactor * 0.2);
};

// Calculate spring animation based on gesture velocity
export const gestureSpring = (velocity: number) => ({
  type: 'spring' as const,
  velocity: velocity / 100,
  stiffness: 300,
  damping: 30,
});

// Hardware acceleration helpers
export const gpuAccelerated = {
  willChange: 'transform, opacity',
  backfaceVisibility: 'hidden' as const,
  perspective: 1000,
  transform: 'translateZ(0)',
};

// Create stagger animation for lists
export const createStagger = (itemCount: number, delayPerItem = 0.05) => ({
  container: {
    animate: {
      transition: {
        staggerChildren: delayPerItem,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  },
});

// Scroll-linked animation helpers
export const scrollProgress = (
  scrollY: number,
  start: number,
  end: number
): number => {
  if (scrollY <= start) return 0;
  if (scrollY >= end) return 1;
  return (scrollY - start) / (end - start);
};

// Interpolate between two values based on progress
export const interpolate = (
  progress: number,
  inputRange: [number, number],
  outputRange: [number, number]
): number => {
  const [inputStart, inputEnd] = inputRange;
  const [outputStart, outputEnd] = outputRange;
  const clampedProgress = Math.max(inputStart, Math.min(inputEnd, progress));
  const normalizedProgress = (clampedProgress - inputStart) / (inputEnd - inputStart);
  return outputStart + normalizedProgress * (outputEnd - outputStart);
};

// Haptic patterns for different interactions
export const hapticPatterns = {
  tap: { type: 'light' as const },
  success: { type: 'success' as const },
  warning: { type: 'warning' as const },
  error: { type: 'error' as const },
  selection: { type: 'selection' as const },
  impact: { type: 'medium' as const },
  heavyImpact: { type: 'heavy' as const },
};

// CSS-based animation utilities for non-Framer-Motion contexts
export const cssAnimations = {
  fadeIn: 'animate-fade-in',
  fadeOut: 'animate-fade-out',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  scaleIn: 'animate-scale-in',
  scaleOut: 'animate-scale-out',
  bounceIn: 'animate-bounce-in',
  pulse: 'animate-pulse-scale',
  spin: 'animate-spin',
};

// Transition presets for CSS transitions
export const cssTransitions = {
  fast: 'transition-all duration-150 ease-out',
  normal: 'transition-all duration-300 ease-out',
  slow: 'transition-all duration-500 ease-out',
  spring: 'transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]',
  ios: 'transition-all duration-350 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
};
