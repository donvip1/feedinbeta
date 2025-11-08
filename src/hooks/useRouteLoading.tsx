import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const useRouteLoading = (delay: number = 200) => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [location.pathname, delay]);

  return isLoading;
};