import React, { createContext, useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SessionManager } from '@/lib/session-manager';
import { CookieManager } from '@/lib/cookie-manager';
import { startupPreloader } from '@/lib/startup-preloader';
import { backgroundSync } from '@/lib/background-sync';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// Clear all local storage related to auth and app state
const clearAllLocalData = () => {
  // Clear localStorage
  const keysToPreserve = ['theme', 'device_fp']; // Keep theme preference and device fingerprint
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (!keysToPreserve.includes(key)) {
      localStorage.removeItem(key);
    }
  });
  
  // Clear sessionStorage completely
  sessionStorage.clear();
  
  // Clear all session-related cookies
  SessionManager.clearAll();
  
  // Clear any auth-related cookies
  const cookies = CookieManager.getAll();
  Object.keys(cookies).forEach(name => {
    if (name.startsWith('sb-') || name.includes('supabase') || name.includes('auth')) {
      CookieManager.remove(name);
    }
  });
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Refresh session manually if needed
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      setSession(newSession);
      setUser(newSession?.user ?? null);
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // If refresh fails, sign out the user
      await signOut();
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle specific auth events
        if (event === 'SIGNED_IN') {
          // Start aggressive preload for offline-first experience
          if (session?.user) {
            startupPreloader.startPreload(session.user.id);
            backgroundSync.initialize(session.user.id);
            // Defer profile sync to avoid deadlock
            setTimeout(() => {
              syncUserProfile(session.user);
            }, 0);
          }
        } else if (event === 'SIGNED_OUT') {
          // Stop background sync and reset preloader
          backgroundSync.stop();
          startupPreloader.reset();
          // Clear all local data on sign out
          clearAllLocalData();
          setUser(null);
          setSession(null);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refreshed successfully - session extended
        } else if (event === 'USER_UPDATED') {
          // User data was updated, sync profile if needed
          if (session?.user) {
            setTimeout(() => {
              syncUserProfile(session.user);
            }, 0);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sync user profile data after auth events
  const syncUserProfile = async (user: User) => {
    try {
      // Check if profile exists
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking profile:', fetchError);
        return;
      }

      // If no profile exists, the database trigger should have created it
      // But we can update metadata if needed
      if (profile) {
        const metadata = user.user_metadata;
        if (metadata?.display_name || metadata?.username) {
          const updates: { display_name?: string; username?: string } = {};
          
          if (metadata.display_name && metadata.display_name !== profile.display_name) {
            updates.display_name = metadata.display_name;
          }
          if (metadata.username && metadata.username !== profile.username) {
            updates.username = metadata.username;
          }
          
          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', user.id);

            if (updateError) {
              console.error('Error syncing profile:', updateError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Profile sync error:', error);
    }
  };

  // Standard sign out - clears current device session
  const signOut = async () => {
    try {
      setLoading(true);
      
      // Invalidate current session in database
      try {
        await supabase.rpc('invalidate_all_sessions');
      } catch (e) {
        // Continue even if this fails
      }
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      
      // Clear all local data
      clearAllLocalData();
      
      // Clear state
      setUser(null);
      setSession(null);
      
      toast({
        title: "Signed out successfully",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Force clear anyway
      clearAllLocalData();
      setUser(null);
      setSession(null);
      toast({
        title: "Signed out",
        description: "Your session has been cleared",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sign out from all devices
  const signOutAllDevices = async () => {
    try {
      setLoading(true);
      
      // Invalidate all sessions in database
      try {
        await supabase.rpc('invalidate_all_sessions');
      } catch (e) {
        // Continue even if this fails
      }
      
      // Sign out from Supabase globally
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      
      // Clear all local data
      clearAllLocalData();
      
      // Clear state
      setUser(null);
      setSession(null);
      
      toast({
        title: "Signed out from all devices",
        description: "All your sessions have been terminated",
      });
    } catch (error: any) {
      console.error('Sign out all devices error:', error);
      // Force clear anyway
      clearAllLocalData();
      setUser(null);
      setSession(null);
      toast({
        title: "Signed out",
        description: "Your sessions have been cleared",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signOut, 
      signOutAllDevices,
      refreshSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
