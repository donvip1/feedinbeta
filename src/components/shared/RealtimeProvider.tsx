import React from 'react';
import { useRealtimeSubscriptions } from '@/hooks/useRealtimeSubscriptions';

/**
 * Component that initializes global real-time subscriptions
 * Place this inside AuthProvider and QueryClientProvider
 */
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize all real-time subscriptions
  useRealtimeSubscriptions();
  
  return <>{children}</>;
};
