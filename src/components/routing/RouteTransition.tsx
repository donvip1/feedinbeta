import { useEffect, useState } from 'react';
import { useLocation, useNavigation } from 'react-router-dom';
import { GenericPageSkeleton } from './PageSkeletons';

interface RouteTransitionProps {
  children: React.ReactNode;
  showSkeleton?: boolean;
}

export const RouteTransition = ({ children, showSkeleton = true }: RouteTransitionProps) => {
  const location = useLocation();
  const navigation = useNavigation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Show transition briefly when location changes
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const isNavigating = navigation.state === 'loading';

  if ((isNavigating || isTransitioning) && showSkeleton) {
    return <GenericPageSkeleton />;
  }

  return (
    <div className="animate-in fade-in duration-300">
      {children}
    </div>
  );
};