import { NavigateFunction } from 'react-router-dom';

export const navigateTo = (navigate: NavigateFunction, path: string, options?: { replace?: boolean; state?: any }) => {
  navigate(path, options);
};

export const isAuthRoute = (pathname: string): boolean => {
  return pathname === '/auth' || pathname === '/';
};

export const isProtectedRoute = (pathname: string): boolean => {
  const publicRoutes = ['/', '/auth'];
  return !publicRoutes.includes(pathname);
};

export const getRedirectPath = (from?: string): string => {
  if (!from || from === '/' || from === '/auth') {
    return '/feed';
  }
  return from;
};

export const buildQueryString = (params: Record<string, string>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  return searchParams.toString();
};

export const parseQueryString = (search: string): Record<string, string> => {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};
