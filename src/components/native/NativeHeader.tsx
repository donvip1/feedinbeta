import React, { useEffect, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface NativeHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  leftContent?: React.ReactNode;
  transparent?: boolean;
  collapsible?: boolean;
  scrollY?: number;
  collapseThreshold?: number;
  className?: string;
  children?: React.ReactNode;
}

export const NativeHeader: React.FC<NativeHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightContent,
  leftContent,
  transparent = false,
  collapsible = false,
  scrollY = 0,
  collapseThreshold = 100,
  className = '',
  children,
}) => {
  const navigate = useNavigate();
  const { haptic, platform, isNative } = useNativeFeatures();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate collapse state
  useEffect(() => {
    if (collapsible) {
      setIsCollapsed(scrollY > collapseThreshold);
    }
  }, [collapsible, collapseThreshold, scrollY]);

  const handleBack = useCallback(() => {
    haptic('light');
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }, [haptic, navigate, onBack]);

  // Calculate safe area for native platforms
  const safeAreaTop = isNative && platform === 'ios' ? 'pt-12' : 'pt-0';

  // Background opacity based on scroll
  const bgOpacity = collapsible 
    ? Math.min(1, scrollY / (collapseThreshold * 0.5))
    : transparent ? 0 : 1;

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 ${safeAreaTop} ${className}`}
      animate={{
        backdropFilter: bgOpacity > 0 ? 'blur(10px)' : 'none',
      }}
    >
      {/* Background */}
      <motion.div
        className="absolute inset-0 bg-background/95 border-b border-border"
        style={{ opacity: bgOpacity }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-between h-14 px-4">
        {/* Left side */}
        <div className="flex items-center gap-2 min-w-[80px]">
          {showBack && (
            <motion.button
              onClick={handleBack}
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-muted/50 active:bg-muted transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
          )}
          {leftContent}
        </div>

        {/* Center - Title */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          animate={{
            opacity: collapsible && !isCollapsed ? 0 : 1,
            y: collapsible && !isCollapsed ? -10 : 0,
          }}
          transition={{ duration: 0.2 }}
        >
          {title && (
            <h1 className="font-semibold text-base truncate max-w-[200px]">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {subtitle}
            </p>
          )}
        </motion.div>

        {/* Right side */}
        <div className="flex items-center gap-2 min-w-[80px] justify-end">
          {rightContent}
        </div>
      </div>

      {/* Collapsible expanded content */}
      {collapsible && children && (
        <motion.div
          className="overflow-hidden"
          animate={{
            height: isCollapsed ? 0 : 'auto',
            opacity: isCollapsed ? 0 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </motion.header>
  );
};

// Large title header (iOS style)
interface LargeTitleHeaderProps {
  title: string;
  subtitle?: string;
  scrollY: number;
  rightContent?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export const LargeTitleHeader: React.FC<LargeTitleHeaderProps> = ({
  title,
  subtitle,
  scrollY,
  rightContent,
  showBack = false,
  onBack,
}) => {
  const navigate = useNavigate();
  const { haptic, isNative, platform } = useNativeFeatures();

  const COLLAPSE_THRESHOLD = 60;
  const isCollapsed = scrollY > COLLAPSE_THRESHOLD;
  const progress = Math.min(1, scrollY / COLLAPSE_THRESHOLD);

  const handleBack = useCallback(() => {
    haptic('light');
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }, [haptic, navigate, onBack]);

  const safeAreaTop = isNative && platform === 'ios' ? 'pt-12' : 'pt-0';

  return (
    <>
      {/* Fixed small header */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 ${safeAreaTop}`}
        style={{
          backdropFilter: isCollapsed ? 'blur(10px)' : 'none',
        }}
      >
        <motion.div
          className="absolute inset-0 bg-background/95 border-b border-border"
          animate={{ opacity: isCollapsed ? 1 : 0 }}
          transition={{ duration: 0.15 }}
        />

        <div className="relative flex items-center justify-between h-14 px-4">
          {showBack && (
            <motion.button
              onClick={handleBack}
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-muted/50 active:bg-muted"
              whileTap={{ scale: 0.9 }}
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
          )}

          <motion.span
            className="absolute left-1/2 -translate-x-1/2 font-semibold text-base"
            animate={{
              opacity: isCollapsed ? 1 : 0,
              y: isCollapsed ? 0 : -10,
            }}
            transition={{ duration: 0.15 }}
          >
            {title}
          </motion.span>

          <div className="flex items-center gap-2 ml-auto">
            {rightContent}
          </div>
        </div>
      </motion.header>

      {/* Large title */}
      <motion.div
        className={`${safeAreaTop} pt-14`}
        style={{
          opacity: 1 - progress,
          transform: `translateY(${-progress * 20}px)`,
        }}
      >
        <div className="px-4 py-3">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default NativeHeader;
