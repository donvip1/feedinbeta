import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
}

interface Post {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export const useProfile = (profileUserId?: string, currentUserId?: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadProfile = useCallback(async () => {
    if (!profileUserId) return;

    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileUserId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profileUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) throw postsError;
      setPosts(postsData || []);

      if (currentUserId && currentUserId !== profileUserId) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', profileUserId)
          .maybeSingle();

        setIsFollowing(!!followData);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profileUserId, currentUserId, toast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    posts,
    isFollowing,
    loading,
    refreshProfile: loadProfile,
    setIsFollowing,
  };
};
