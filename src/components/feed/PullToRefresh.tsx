import { motion } from 'framer-motion';
import { RefreshCw, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  pullDistance: number;
  pullProgress: number;
  isRefreshing: boolean;
  threshold?: number;
}

export const PullToRefresh = ({
  pullDistance,
  pullProgress,
  isRefreshing,
  threshold = 80,
}: PullToRefreshProps) => {
  const isReady = pullProgress >= 1;
  
  // Calculate rotation based on pull progress
  const rotation = pullProgress * 180;
  
  // Scale the indicator based on progress
  const scale = Math.min(0.5 + pullProgress * 0.5, 1);
  
  // Opacity based on pull distance
  const opacity = Math.min(pullDistance / 30, 1);

  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <motion.div
      className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10"
      style={{
        top: 0,
        height: Math.max(pullDistance, isRefreshing ? 60 : 0),
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isRefreshing ? 1 : opacity }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center gap-2"
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {isRefreshing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <RefreshCw className="w-6 h-6 text-primary" />
          </motion.div>
        ) : (
          <motion.div
            style={{ rotate: rotation }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <ArrowDown 
              className={`w-6 h-6 transition-colors duration-200 ${
                isReady ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          </motion.div>
        )}
        
        {/* Progress ring */}
        <svg className="w-8 h-8 absolute" viewBox="0 0 36 36">
          <path
            className="text-muted/30"
            fill="none"
            strokeWidth="3"
            stroke="currentColor"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <motion.path
            className={`${isReady ? 'text-primary' : 'text-muted-foreground'}`}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${pullProgress * 100}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            style={{
              transition: 'stroke-dasharray 0.1s ease-out',
            }}
          />
        </svg>
        
        {/* Status text */}
        {pullDistance > 30 && !isRefreshing && (
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs font-medium mt-4 ${
              isReady ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {isReady ? 'Release to refresh' : 'Pull to refresh'}
          </motion.span>
        )}
        
        {isRefreshing && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-medium text-primary mt-4"
          >
            Refreshing...
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  );
};

export default PullToRefresh;
