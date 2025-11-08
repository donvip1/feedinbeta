import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAuthRoute, isProtectedRoute, getRedirectPath } from '@/lib/route-helpers';

interface RouteGuardProps {
  children: ReactNode;
}

export const RouteGuard = ({ children }: RouteGuardProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    const currentPath = location.pathname;

    // Redirect authenticated users away from auth pages
    if (user && isAuthRoute(currentPath)) {
      const from = location.state?.from?.pathname;
      navigate(getRedirectPath(from), { replace: true });
      return;
    }

    // Redirect unauthenticated users to auth page for protected routes
    if (!user && isProtectedRoute(currentPath)) {
      navigate('/auth', { 
        replace: true, 
        state: { from: location } 
      });
      return;
    }
  }, [user, loading, location, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};
