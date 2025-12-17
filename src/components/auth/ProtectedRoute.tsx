import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/shared/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute = ({ children, redirectTo = '/auth' }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Store the intended destination for redirect after login
      sessionStorage.setItem('redirectAfterAuth', location.pathname + location.search);
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, redirectTo, location]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
