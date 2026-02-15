import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { FollowersModal } from '@/components/profile/FollowersModal';
import { FriendsModal } from '@/components/profile/FriendsModal';
import { ProfileImageModal } from '@/components/profile/ProfileImageModal';
import { CoverImageCropper } from '@/components/profile/CoverImageCropper';
import { RolePlanBadge } from '@/components/profile/RolePlanBadge';
import { AvatarImageCropper } from '@/components/profile/AvatarImageCropper';
import { BottomNav } from '@/components/navigation/BottomNav';
import { BackButton } from '@/components/navigation/BackButton';
import { ArrowLeft, Settings, Eye, Crown, MessageCircle, Heart, Camera, Instagram, Twitter, Linkedin, Facebook, Youtube, Mic, Link as LinkIcon, Bookmark, FileText, Upload, UserPlus, Rocket, UserCheck, X, MapPin, Briefcase, Bell } from 'lucide-react';

import { getCountryFlag } from '@/lib/location-service';
import { PostsGrid } from '@/components/profile/PostsGrid';
import { ViewHistory } from '@/components/profile/ViewHistory';
import { usePageRefresh } from '@/context/RefreshContext';
import { useProfileWithCache } from '@/hooks/useProfileWithCache';
import { useProfileCounts, getCachedCounts, prefetchProfileCounts } from '@/hooks/useProfileCounts';
import { memoryCache } from '@/lib/memory-cache';
import { usernameCache } from '@/lib/username-cache';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { QueryErrorFallback } from '@/components/shared/QueryErrorFallback';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio: string | null;
  purpose: string[] | null;
  marital_status: string | null;
  total_views: number;
  is_premium: boolean;
  post_count: number;
  followers_count: number;
  following_count: number;
  friends_count: number;
  instagram_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  country?: string | null;
  city?: string | null;
  detected_country_code?: string | null;
  phone_number?: string | null;
  occupation?: string | null;
}

const PURPOSE_OPTIONS: Record<string, string> = {
  friends: "Make friends",
  dating: "Dating",
  networking: "Networking",
  business: "Business",
  gaming: "Gaming",
  learning: "Learning",
  content: "Find content",
  streaming: "Live streaming",
  browsing: "Just browsing",
};

const Profile = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false); // Start with false - show cached data immediately
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [isFollowingMe, setIsFollowingMe] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [tempCoverImageUrl, setTempCoverImageUrl] = useState<string>('');
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [tempAvatarImageUrl, setTempAvatarImageUrl] = useState<string>('');

  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [areMutualFriends, setAreMutualFriends] = useState(false);
  // Track if viewed user has sent a friend request TO the current user
  const [incomingRequestFromUser, setIncomingRequestFromUser] = useState<{
    id: string;
    sender_id: string;
    created_at: string;
  } | null>(null);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<{
    id: string;
    sender_id: string;
    created_at: string;
    sender_profile: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    } | null;
  }[]>([]);

  // Use cached profile hook - this returns cached data INSTANTLY
  const { profile: cachedProfile, isLoading: cacheLoading, refetch: refetchCached } = useProfileWithCache(identifier);
  
  // INSTANT: Try to get userId from identifier immediately for faster count loading
  const immediateUserId = identifier ? (
    identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) 
      ? identifier 
      : usernameCache.get(identifier) || null
  ) : null;
  
  // Use immediate userId if available, otherwise wait for resolved
  const countsUserId = resolvedUserId || immediateUserId;
  
  // INSTANT: Use profile counts hook for real-time, cached counts
  const { counts, refetch: refetchCounts } = useProfileCounts(countsUserId);
  
  // INSTANT: Also try to get cached counts synchronously for immediate display
  const cachedCounts = countsUserId ? getCachedCounts(countsUserId) : null;
  const displayCounts = cachedCounts || counts;

  // Helper to check if string is UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // INSTANT: Set profile from cache immediately when available
  useEffect(() => {
    if (cachedProfile) {
      setProfile(prev => ({
        ...prev,
        ...cachedProfile,
        post_count: prev?.post_count || cachedProfile.posts_count || 0,
        total_views: prev?.total_views || 0,
      } as Profile));
      // Don't show loading if we have cached data
      setLoading(false);
    }
  }, [cachedProfile]);

  // INSTANT: Resolve identifier to userId using username cache first
  useEffect(() => {
    const resolveIdentifier = async () => {
      if (!identifier) return;
      
      if (isUUID(identifier)) {
        setResolvedUserId(identifier);
      } else {
        // Try username cache first (INSTANT)
        const cachedId = usernameCache.get(identifier);
        if (cachedId) {
          setResolvedUserId(cachedId);
          return;
        }
        
        // Fall back to database lookup
        const { data, error } = await supabase
          .rpc('get_user_by_username', { p_username: identifier });
        
        if (error || !data) {
          toast({
            title: 'User not found',
            description: `No user with username "${identifier}" exists.`,
            variant: 'destructive',
          });
          navigate('/feed');
          return;
        }
        
        // Cache the mapping for next time
        await usernameCache.set(identifier, data);
        setResolvedUserId(data);
      }
    };
    
    resolveIdentifier();
  }, [identifier]);

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/welcome');
      return;
    }
    
    if (!resolvedUserId) return;
    
    const isOwn = user?.id === resolvedUserId;
    setIsOwnProfile(isOwn);
    
    // Load fresh profile in background (cache already shown)
    loadProfile(false);
    
    // Load friend requests for own profile
    if (isOwn) {
      loadPendingFriendRequests();
    }
    
    if (!isOwn && user) {
      // Run all status checks in parallel
      Promise.all([
        checkFollowStatus(),
        checkIfFollowingMe(),
        checkFriendRequestStatus(),
        checkMutualFriendStatus(),
        checkIncomingRequestFromUser()
      ]);
    }
  }, [resolvedUserId, user?.id]);

  // Subscribe to silent refresh from navigation
  usePageRefresh('profile', useCallback(() => {
    // Silent background refresh
    loadProfile(false);
    refetchCached();
    refetchCounts();
    if (isOwnProfile) {
      loadPendingFriendRequests();
    }
  }, [isOwnProfile, refetchCached, refetchCounts]));

  const loadProfile = async (showLoading = true) => {
    if (!resolvedUserId) return;
    
    // NEVER show loading if we have any cached data
    if (showLoading && !profile && !cachedProfile) {
      setLoading(true);
    }
    
    try {
      // Use public_profiles for viewing OTHER users' profiles (secure view)
      // Use profiles for viewing OWN profile (full access)
      const isOwnProfile = resolvedUserId === user?.id;
      
      // Fetch profile and counts in parallel
      const [profileResult, postCountResult, totalLikesResult, friendsCountResult] = await Promise.all([
        isOwnProfile 
          ? supabase.from('profiles').select('*').eq('id', resolvedUserId).maybeSingle()
          : supabase.from('public_profiles').select('*').eq('id', resolvedUserId).maybeSingle(),
        supabase.rpc('get_user_post_count', { user_uuid: resolvedUserId }),
        supabase.rpc('get_user_total_likes', { user_uuid: resolvedUserId }),
        // Count friends (accepted friend requests where user is sender or receiver)
        supabase
          .from('friend_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`sender_id.eq.${resolvedUserId},receiver_id.eq.${resolvedUserId}`)
      ]);

      if (profileResult.error) throw profileResult.error;
      
      if (!profileResult.data) {
        // Only show error if we don't have cached data
        if (!profile && !cachedProfile) {
          toast({
            title: 'Profile not found',
            description: 'This profile does not exist.',
            variant: 'destructive',
          });
          navigate('/feed');
        }
        return;
      }

      const friendsTotal = friendsCountResult.count || 0;

      const fullProfile = {
        ...(profileResult.data as any),
        post_count: postCountResult.data || 0,
        total_views: totalLikesResult.data || 0,
        friends_count: friendsTotal,
      } as Profile;

      setProfile(fullProfile);
      
      // Cache the profile for instant access next time
      memoryCache.set(`profile:${identifier}`, fullProfile, 10 * 60 * 1000);
      if (resolvedUserId !== identifier) {
        memoryCache.set(`profile:${resolvedUserId}`, fullProfile, 10 * 60 * 1000);
      }
      
      // Cache username mapping
      if (fullProfile.username) {
        await usernameCache.set(fullProfile.username, resolvedUserId);
      }
    } catch (error: any) {
      // Only show error if we don't have cached data
      if (!profile && !cachedProfile) {
        toast({
          title: 'Error loading profile',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!user || !resolvedUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', resolvedUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowing(!!data);
    } catch (error: any) {
      console.error('Error checking follow status:', error);
    }
  };

  const checkIfFollowingMe = async () => {
    if (!user || !resolvedUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', resolvedUserId)
        .eq('following_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowingMe(!!data);
    } catch (error: any) {
      console.error('Error checking if following me:', error);
    }
  };

  const checkFriendRequestStatus = async () => {
    if (!user || !resolvedUserId) return;

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', resolvedUserId)
        .eq('status', 'pending')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setHasPendingRequest(!!data);
    } catch (error: any) {
      console.error('Error checking friend request status:', error);
    }
  };

  const checkMutualFriendStatus = async () => {
    if (!user || !resolvedUserId) return;

    try {
      const { data, error } = await supabase.rpc('are_mutual_friends', {
        user1_id: user.id,
        user2_id: resolvedUserId
      });

      if (error) throw error;
      setAreMutualFriends(!!data);
    } catch (error: any) {
      console.error('Error checking mutual friend status:', error);
    }
  };

  // Check if the viewed user has sent a friend request TO the current user
  const checkIncomingRequestFromUser = async () => {
    if (!user || !resolvedUserId) return;

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, sender_id, created_at')
        .eq('sender_id', resolvedUserId)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIncomingRequestFromUser(data);
    } catch (error: any) {
      console.error('Error checking incoming request:', error);
    }
  };

  const loadPendingFriendRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, sender_id, created_at')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles
      if (data && data.length > 0) {
        const senderIds = data.map(r => r.sender_id);
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', senderIds);

        const requestsWithProfiles = data.map(request => ({
          ...request,
          sender_profile: profiles?.find(p => p.id === request.sender_id) || null
        }));

        setPendingFriendRequests(requestsWithProfiles);
      } else {
        setPendingFriendRequests([]);
      }
    } catch (error: any) {
      console.error('Error loading pending friend requests:', error);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string, senderId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      // Notification is created automatically by database trigger

      toast({
        title: 'Friend request accepted!',
        description: 'You can now chat with this user.',
      });

      // Reload requests
      loadPendingFriendRequests();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeclineFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: 'Friend request declined',
      });

      // Reload requests
      loadPendingFriendRequests();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };


  const toggleFollow = async () => {
    if (!user || !resolvedUserId) return;

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', resolvedUserId);
        setIsFollowing(false);
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: resolvedUserId,
        });
        setIsFollowing(true);
      }
      loadProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const requestChat = async () => {
    if (!user || !resolvedUserId) return;

    try {
      // First check if already mutual friends
      const { data: areFriends, error: friendCheckError } = await supabase
        .rpc('are_mutual_friends', {
          user1_id: user.id,
          user2_id: resolvedUserId
        });

      if (friendCheckError) throw friendCheckError;

      if (areFriends) {
        // If already friends, create/open conversation
        const { data: conversationId, error } = await supabase.rpc('create_conversation', {
          other_user_id: resolvedUserId
        });

        if (error) throw error;
        navigate(`/messages?conversation=${conversationId}`);
      } else {
        // If not friends, send friend request
        const { error: requestError } = await supabase
          .from('friend_requests')
          .insert({
            sender_id: user.id,
            receiver_id: resolvedUserId,
            status: 'pending'
          });

        if (requestError) {
          // Check if request already exists
          if (requestError.code === '23505') {
            toast({
              title: 'Friend request already sent',
              description: 'Waiting for the user to accept.',
            });
          } else {
            throw requestError;
          }
        } else {
          // Create notification for the receiver
          await supabase
            .from('notifications')
            .insert({
              user_id: resolvedUserId,
              from_user_id: user.id,
              type: 'friend_request',
              title: 'New friend request',
              message: `${profile?.display_name || profile?.username || 'Someone'} sent you a friend request`,
              related_id: user.id,
              related_type: 'profile'
            });

          setHasPendingRequest(true);
          checkMutualFriendStatus(); // Recheck status
          toast({
            title: 'Friend request sent!',
            description: 'You can chat once they accept your request.',
          });
        }
      }
    } catch (error: any) {
      console.error('Request chat error:', error);
      toast({
        title: 'Unable to send request',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const startConversation = async () => {
    if (!user || !resolvedUserId) return;

    try {
      const { data: conversationId, error } = await supabase.rpc('create_conversation', {
        other_user_id: resolvedUserId
      });

      if (error) throw error;

      navigate(`/messages?conversation=${conversationId}`);
    } catch (error: any) {
      toast({
        title: 'Unable to start conversation',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Create temporary URL for cropper
    const imageUrl = URL.createObjectURL(file);
    setTempAvatarImageUrl(imageUrl);
    setShowAvatarCropper(true);
  };

  const handleCroppedAvatarUpload = async (croppedBlob: Blob) => {
    if (!user) return;

    try {
      setUploading(true);
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('posts').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await loadProfile();
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been changed',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading avatar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Clean up temporary URL
      if (tempAvatarImageUrl) {
        URL.revokeObjectURL(tempAvatarImageUrl);
        setTempAvatarImageUrl('');
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Create temporary URL for cropper
    const imageUrl = URL.createObjectURL(file);
    setTempCoverImageUrl(imageUrl);
    setShowCoverCropper(true);
  };

  const handleCroppedCoverUpload = async (croppedBlob: Blob) => {
    if (!user) return;

    try {
      setUploadingCover(true);
      const fileName = `cover-${user.id}-${Date.now()}.jpg`;
      const filePath = `covers/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('posts').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await loadProfile();
      
      toast({
        title: 'Cover photo updated',
        description: 'Your cover photo has been changed',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading cover',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingCover(false);
      // Clean up temporary URL
      if (tempCoverImageUrl) {
        URL.revokeObjectURL(tempCoverImageUrl);
        setTempCoverImageUrl('');
      }
    }
  };

  // Only show loading spinner if we have NO profile data at all
  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain scroll-smooth pb-20" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Profile Header */}
      <div className="relative">
        {/* Cover photo or gradient - extends to top */}
        <div className="relative h-64 bg-gradient-to-br from-primary/40 via-accent/30 to-background">
          {profile.cover_url && (
            <img 
              src={profile.cover_url} 
              alt="Cover" 
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setShowCoverModal(true)}
            />
          )}
          
          {/* Header controls overlaid on cover */}
          <div className="absolute top-0 left-0 right-0 z-40">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <BackButton fallback="/feed" className="bg-background/40 backdrop-blur-md hover:bg-background/60 border border-background/20 shadow-lg" />
              {isOwnProfile && (
                <Button 
                  onClick={() => navigate('/settings')} 
                  variant="ghost" 
                  size="icon" 
                  className="bg-background/40 backdrop-blur-md hover:bg-background/60 border border-background/20 shadow-lg"
                >
                  <Settings className="w-5 h-5 text-foreground" />
                </Button>
              )}
            </div>
          </div>

          {isOwnProfile && (
            <label
              htmlFor="cover-upload"
              className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm rounded-full p-2 cursor-pointer hover:bg-background transition-colors shadow-lg"
            >
              <Upload className="w-4 h-4 text-foreground" />
              <input
                id="cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
                disabled={uploadingCover}
              />
            </label>
          )}
        </div>
        
        {/* Profile Info */}
        <div className="container mx-auto px-4 -mt-20 max-w-2xl">
          {/* Avatar - Centered */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Avatar 
                className="w-32 h-32 border-4 border-background shadow-xl cursor-pointer"
                onClick={() => setShowAvatarModal(true)}
              >
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {profile.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label
                  htmlFor="profile-avatar-upload"
                  className="absolute bottom-0 right-0 bg-gradient-to-r from-primary to-accent rounded-full p-2.5 cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                >
                  <Camera className="w-4 h-4 text-primary-foreground" />
                  <input
                    id="profile-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Name & Username - Centered */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-foreground">
                {profile.display_name || 'Unknown'}
              </h1>
              <RolePlanBadge userId={profile.id} />
              {profile.is_premium && !profile.id && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg">
                  <Crown className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">@{profile.username || 'user'}</p>
            {!isOwnProfile && isFollowingMe && (
              <p className="text-xs text-muted-foreground mt-1">Following you</p>
            )}
          </div>

          {/* Followers, Following, Friends & Likes - Same line, Centered */}
          <div className="flex gap-6 mb-6 justify-center flex-wrap">
            <button
              onClick={() => { setFollowersModalTab('followers'); setShowFollowersModal(true); }}
              className="flex flex-col items-center cursor-pointer hover:opacity-80 transition"
            >
              <p className="text-2xl font-bold text-foreground">{displayCounts.followersCount || profile.followers_count}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>

            <button
              onClick={() => { setFollowersModalTab('following'); setShowFollowersModal(true); }}
              className="flex flex-col items-center cursor-pointer hover:opacity-80 transition"
            >
              <p className="text-2xl font-bold text-foreground">{displayCounts.followingCount || profile.following_count}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>

            {/* Friends - Show count and modal for own profile or if mutual friends, otherwise show "Not Friends" */}
            {isOwnProfile || areMutualFriends ? (
              <button
                onClick={() => setShowFriendsModal(true)}
                className="flex flex-col items-center cursor-pointer hover:opacity-80 transition"
              >
                <p className="text-2xl font-bold text-foreground">{displayCounts.friendsCount}</p>
                <p className="text-xs text-muted-foreground">Friends</p>
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">Not Friends</p>
              </div>
            )}

            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-foreground">{displayCounts.likesCount}</p>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-foreground">{displayCounts.viewsCount || 0}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>

          </div>


          {/* Purpose */}
          {profile.purpose && profile.purpose.length > 0 && (
            <div className="mb-4">
              <span className="text-xs text-muted-foreground mb-2 block">Purpose on Platform</span>
              <div className="flex flex-wrap gap-2">
                {profile.purpose.map((purposeKey) => (
                  <Badge key={purposeKey} variant="secondary" className="text-xs">
                    {PURPOSE_OPTIONS[purposeKey] || purposeKey}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-foreground mb-4 leading-relaxed">{profile.bio}</p>
          )}

          {/* Location & Occupation Info */}
          {(profile.country || profile.city || profile.occupation) && (
            <div className="flex flex-wrap gap-3 mb-4">
              {(profile.country || profile.city) && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {profile.detected_country_code && getCountryFlag(profile.detected_country_code)}{' '}
                    {profile.city && profile.country ? `${profile.city}, ${profile.country}` : (profile.city || profile.country)}
                  </span>
                </div>
              )}
              {profile.occupation && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  <Briefcase className="w-4 h-4" />
                  <span>{profile.occupation}</span>
                </div>
              )}
            </div>
          )}

          {/* Friend Requests Section - Only for own profile */}
          {isOwnProfile && pendingFriendRequests.length > 0 && (
            <Card className="mb-6 p-4 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Friend Requests
                </h3>
                <Badge variant="secondary" className="bg-primary text-primary-foreground">
                  {pendingFriendRequests.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {pendingFriendRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                  >
                    <div 
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => navigate(`/profile/${request.sender_id}`)}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={request.sender_profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {request.sender_profile?.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {request.sender_profile?.display_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{request.sender_profile?.username || 'user'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptFriendRequest(request.id, request.sender_id)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineFriendRequest(request.id)}
                        className="text-muted-foreground hover:text-destructive hover:border-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Action Buttons - Centered, BEFORE Posts */}
          {isOwnProfile ? (
            <div className="flex gap-3 mb-6 justify-center max-w-md mx-auto">
              <Button
                onClick={() => navigate('/saved')}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-lg"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Saved
              </Button>
              <Button
                onClick={() => navigate('/promotions')}
                variant="outline"
                className="flex-1 border-primary/50 text-primary hover:bg-primary/10"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Promotions
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-6 max-w-md mx-auto">
              {/* Incoming request Accept/Decline buttons */}
              {incomingRequestFromUser && !areMutualFriends && (
                <div className="flex gap-2 p-3 bg-primary/10 rounded-xl border border-primary/20">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">
                      {profile?.display_name || profile?.username || 'This user'} sent you a chat request
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAcceptFriendRequest(incomingRequestFromUser.id, incomingRequestFromUser.sender_id)}
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        onClick={() => handleDeclineFriendRequest(incomingRequestFromUser.id)}
                        size="sm"
                        variant="outline"
                        className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Follow and Message buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={toggleFollow}
                  className={
                    isFollowing
                      ? 'flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border'
                      : 'flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-lg'
                  }
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                
                {areMutualFriends ? (
                  <Button
                    onClick={startConversation}
                    variant="outline"
                    className="flex-1 border-primary/50 text-primary hover:bg-primary/10"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                ) : (
                  <Button
                    onClick={requestChat}
                    disabled={hasPendingRequest || !!incomingRequestFromUser}
                    variant="outline"
                    className="flex-1 border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {hasPendingRequest ? 'Request Sent' : incomingRequestFromUser ? 'Request Pending' : 'Request Chat'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Posts Section - Scrollable Grid */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Posts ({profile.post_count})
              </h3>
            </div>
            <PostsGrid userId={resolvedUserId || ''} />
          </div>

          {/* View History - Only for own profile */}
          {isOwnProfile && (
            <div className="mb-6">
              <ViewHistory />
            </div>
          )}

          {/* Details Section */}
          <div className="space-y-4">

            {profile.purpose && Array.isArray(profile.purpose) && profile.purpose.length > 0 && (
              <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-foreground mb-3 text-base">Purpose</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.purpose.map((purposeValue) => {
                    const purposeLabel = PURPOSE_OPTIONS[purposeValue];
                    return purposeLabel ? (
                      <Badge 
                        key={purposeValue}
                        variant="secondary"
                        className="bg-primary/10 text-primary"
                      >
                        {purposeLabel}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {profile.marital_status && (
              <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-foreground mb-3 text-base">Marital Status</h3>
                <p className="text-muted-foreground text-sm capitalize">{profile.marital_status}</p>
              </div>
            )}

            {/* Social Links */}
            {(profile.instagram_url || profile.twitter_url || profile.linkedin_url || 
              profile.facebook_url || profile.tiktok_url || profile.youtube_url || profile.website_url) && (
              <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-base">
                  <LinkIcon className="w-4 h-4" />
                  Social Links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.instagram_url && (
                    <a
                      href={profile.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-lg hover:from-pink-700 hover:to-rose-700 transition-all text-sm font-medium shadow-lg"
                    >
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </a>
                  )}
                  {profile.twitter_url && (
                    <a
                      href={profile.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium shadow-lg"
                    >
                      <Twitter className="w-4 h-4" />
                      Twitter
                    </a>
                  )}
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-all text-sm font-medium shadow-lg"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                  {profile.facebook_url && (
                    <a
                      href={profile.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-lg"
                    >
                      <Facebook className="w-4 h-4" />
                      Facebook
                    </a>
                  )}
                  {profile.tiktok_url && (
                    <a
                      href={profile.tiktok_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg hover:bg-gray-200 transition-all text-sm font-medium shadow-lg"
                    >
                      <Mic className="w-4 h-4" />
                      TikTok
                    </a>
                  )}
                  {profile.youtube_url && (
                    <a
                      href={profile.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium shadow-lg"
                    >
                      <Youtube className="w-4 h-4" />
                      YouTube
                    </a>
                  )}
                  {profile.website_url && (
                    <a
                      href={profile.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-sm font-medium shadow-lg"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Settings Drawer */}
      
      
      {/* Followers/Following Modal */}
      <FollowersModal
        open={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={resolvedUserId || ''}
        defaultTab={followersModalTab}
      />

      {/* Friends Modal */}
      <FriendsModal
        open={showFriendsModal}
        onClose={() => setShowFriendsModal(false)}
        userId={resolvedUserId || ''}
        friendsCount={displayCounts.friendsCount}
      />

      {/* Profile Image Modals */}
      {profile.avatar_url && (
        <ProfileImageModal
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
          imageUrl={profile.avatar_url}
          title="Profile Picture"
        />
      )}
      
      {profile.cover_url && (
        <ProfileImageModal
          isOpen={showCoverModal}
          onClose={() => setShowCoverModal(false)}
          imageUrl={profile.cover_url}
          title="Cover Photo"
        />
      )}

      {/* Cover Image Cropper */}
      <CoverImageCropper
        isOpen={showCoverCropper}
        onClose={() => {
          setShowCoverCropper(false);
          if (tempCoverImageUrl) {
            URL.revokeObjectURL(tempCoverImageUrl);
            setTempCoverImageUrl('');
          }
        }}
        imageUrl={tempCoverImageUrl}
        onCropComplete={handleCroppedCoverUpload}
      />

      {/* Avatar Image Cropper */}
      <AvatarImageCropper
        isOpen={showAvatarCropper}
        onClose={() => {
          setShowAvatarCropper(false);
          if (tempAvatarImageUrl) {
            URL.revokeObjectURL(tempAvatarImageUrl);
            setTempAvatarImageUrl('');
          }
        }}
        imageUrl={tempAvatarImageUrl}
        onCropComplete={handleCroppedAvatarUpload}
      />
      
      <BottomNav transparent={false} />
    </div>
  );
};

export default Profile;
