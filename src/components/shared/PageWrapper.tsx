import type { FC, ReactNode } from 'react';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface PageWrapperProps {
  children: ReactNode;
  pageName?: string;
  loading?: boolean;
  loadingFallback?: ReactNode;
}

const DefaultLoadingFallback = () => (
  <div className="min-h-screen bg-background p-4 space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const PageWrapper: FC<PageWrapperProps> = ({ 
  children, 
  pageName,
  loading = false,
  loadingFallback
}) => {
  if (loading) {
    return <>{loadingFallback || <DefaultLoadingFallback />}</>;
  }

  return (
    <SectionErrorBoundary sectionName={pageName}>
      <Suspense fallback={loadingFallback || <DefaultLoadingFallback />}>
        {children}
      </Suspense>
    </SectionErrorBoundary>
  );
};

// Section wrapper for parts of a page
interface SectionWrapperProps {
  children: ReactNode;
  sectionName?: string;
  onRetry?: () => void;
  fallback?: ReactNode;
}

export const SectionWrapper: FC<SectionWrapperProps> = ({
  children,
  sectionName,
  onRetry,
  fallback
}) => (
  <SectionErrorBoundary sectionName={sectionName} onRetry={onRetry} fallback={fallback}>
    {children}
  </SectionErrorBoundary>
);
