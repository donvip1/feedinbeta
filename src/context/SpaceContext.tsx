import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SpaceInfo {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  startedAt: string;
}

interface SpaceState {
  isActive: boolean;
  isMinimized: boolean;
  spaceInfo: SpaceInfo | null;
  isMuted: boolean;
  myRole: 'host' | 'co_host' | 'speaker' | 'listener';
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting';
}

interface SpaceContextType {
  spaceState: SpaceState;
  joinSpace: (spaceInfo: SpaceInfo, role: string) => void;
  leaveSpace: () => void;
  minimizeSpace: () => void;
  maximizeSpace: () => void;
  setMuted: (muted: boolean) => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting') => void;
  updateRole: (role: string) => void;
}

const defaultState: SpaceState = {
  isActive: false,
  isMinimized: false,
  spaceInfo: null,
  isMuted: true,
  myRole: 'listener',
  connectionStatus: 'disconnected',
};

const SpaceContext = createContext<SpaceContextType | null>(null);

export const useSpaceContext = () => {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpaceContext must be used within SpaceProvider');
  }
  return context;
};

export const useOptionalSpaceContext = () => {
  return useContext(SpaceContext);
};

export const SpaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [spaceState, setSpaceState] = useState<SpaceState>(defaultState);
  const cleanupRef = useRef<(() => void) | null>(null);

  const joinSpace = useCallback((spaceInfo: SpaceInfo, role: string) => {
    setSpaceState({
      isActive: true,
      isMinimized: false,
      spaceInfo,
      isMuted: role !== 'host',
      myRole: role as SpaceState['myRole'],
      connectionStatus: 'connecting',
    });
  }, []);

  const leaveSpace = useCallback(async () => {
    if (spaceState.spaceInfo && user) {
      // Mark user as left in database
      await supabase
        .from('live_space_speakers')
        .update({ left_at: new Date().toISOString() })
        .eq('space_id', spaceState.spaceInfo.id)
        .eq('user_id', user.id);
    }
    
    // Cleanup audio elements
    document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove());
    
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    setSpaceState(defaultState);
  }, [spaceState.spaceInfo, user]);

  const minimizeSpace = useCallback(() => {
    setSpaceState(prev => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeSpace = useCallback(() => {
    setSpaceState(prev => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setSpaceState(prev => ({
      ...prev,
      isMuted: muted,
    }));
  }, []);

  const setConnectionStatus = useCallback((status: 'disconnected' | 'connecting' | 'connected' | 'failed' | 'reconnecting') => {
    setSpaceState(prev => ({
      ...prev,
      connectionStatus: status,
    }));
  }, []);

  const updateRole = useCallback((role: string) => {
    setSpaceState(prev => ({
      ...prev,
      myRole: role as SpaceState['myRole'],
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return (
    <SpaceContext.Provider
      value={{
        spaceState,
        joinSpace,
        leaveSpace,
        minimizeSpace,
        maximizeSpace,
        setMuted,
        setConnectionStatus,
        updateRole,
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
};
