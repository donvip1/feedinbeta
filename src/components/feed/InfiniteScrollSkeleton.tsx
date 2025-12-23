import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

interface InfiniteScrollSkeletonProps {
  count?: number;
}

export const InfiniteScrollSkeleton = ({ count = 2 }: InfiniteScrollSkeletonProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 p-4"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          
          {/* Media placeholder */}
          <Skeleton className="w-full aspect-[4/5]" />
          
          {/* Actions */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default InfiniteScrollSkeleton;
