import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getOrCreateFingerprint, getDeviceInfo, getDeviceName } from '@/lib/device-fingerprint';

const ACTIVITY_INTERVAL = 5 * 60 * 1000; // Update activity every 5 minutes
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days

interface UseSecureSessionOptions {
  onSessionExpired?: () => void;
  onSuspiciousActivity?: (event: string) => void;
}

export function useSecureSession(options: UseSecureSessionOptions = {}) {
  const { user, session, signOut } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string | null>(null);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track user activity
  const updateActivity = useCallback(async () => {
    if (!user || !session) return;
    
    lastActivityRef.current = Date.now();
    
    try {
      const fingerprint = await getOrCreateFingerprint();
      const deviceInfo = getDeviceInfo();
      
      const { data } = await supabase.rpc('upsert_user_session', {
        p_device_fingerprint: fingerprint,
        p_device_info: {
          name: getDeviceName(),
          ...deviceInfo,
        },
        p_user_agent: navigator.userAgent,
      });
      
      if (data) {
        sessionIdRef.current = data;
      }
    } catch (error) {
      // Silent fail - don't disrupt user experience
      console.error('Session update failed:', error);
    }
  }, [user, session]);

  // Log security event
  const logSecurityEvent = useCallback(async (
    eventType: string,
    eventData: Record<string, any> = {}
  ) => {
    if (!user) return;
    
    try {
      await supabase.rpc('log_security_event', {
        p_event_type: eventType,
        p_event_data: eventData,
        p_user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, [user]);

  // Check for session timeout
  const checkSessionTimeout = useCallback(() => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    
    if (timeSinceActivity > SESSION_TIMEOUT) {
      logSecurityEvent('session_timeout', { 
        inactivityDuration: timeSinceActivity 
      });
      options.onSessionExpired?.();
      signOut();
    }
  }, [signOut, logSecurityEvent, options]);

  // Invalidate all sessions (logout everywhere)
  const logoutAllDevices = useCallback(async () => {
    try {
      await supabase.rpc('invalidate_all_sessions');
      await logSecurityEvent('logout_all_devices');
      await signOut();
    } catch (error) {
      console.error('Failed to logout all devices:', error);
    }
  }, [signOut, logSecurityEvent]);

  // Get active sessions
  const getActiveSessions = useCallback(async () => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_active_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }, [user]);

  // Invalidate specific session
  const invalidateSession = useCallback(async (sessionId: string) => {
    try {
      await supabase.rpc('invalidate_session', { p_session_id: sessionId });
      await logSecurityEvent('session_invalidated', { sessionId });
      return true;
    } catch (error) {
      console.error('Failed to invalidate session:', error);
      return false;
    }
  }, [logSecurityEvent]);

  // Initialize session tracking on mount
  useEffect(() => {
    if (!user || !session) return;

    // Initial session update
    updateActivity();

    // Set up activity tracking interval
    activityIntervalRef.current = setInterval(updateActivity, ACTIVITY_INTERVAL);

    // Set up session timeout check
    const timeoutCheck = setInterval(checkSessionTimeout, 60 * 1000); // Check every minute

    // Track user activity events
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Log sign-in event
    logSecurityEvent('sign_in', { 
      device: getDeviceName(),
      timestamp: new Date().toISOString(),
    });

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
      clearInterval(timeoutCheck);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [user, session, updateActivity, checkSessionTimeout, logSecurityEvent]);

  return {
    sessionId: sessionIdRef.current,
    logoutAllDevices,
    getActiveSessions,
    invalidateSession,
    logSecurityEvent,
    updateActivity,
  };
}
