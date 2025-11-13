import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { ArrowLeft, Settings, Coins, Eye, Crown, UserPlus, MessageCircle, Heart, Camera, Instagram, Twitter, Linkedin, Facebook, Youtube, Mic, Link as LinkIcon } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: string | null;
  about: string | null;
  purpose: string | null;
  marital_status: string | null;
  total_views: number;
  is_premium: boolean;
  credits_balance: number;
  followers_count: number;
  following_count: number;
  instagram_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
}

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      if (isOwnProfile && user?.email) {
        checkAdminStatus(user.email);
      }
      if (!isOwnProfile) {
        checkFollowStatus();
        checkFriendRequestStatus();
      }
    }
  }, [userId]);

  const checkAdminStatus = async (email: string) => {
    const adminEmails = ['viplearn4free@gmail.com', 'cryptosvip@gmail.com', 'myconnectmate@gmail.com'];
    setIsAdmin(adminEmails.includes(email.toLowerCase()));
  };

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          instagram_url,
          twitter_url,
          linkedin_url,
          facebook_url,
          tiktok_url,
          youtube_url,
          website_url
        `)
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get credits balance from credit_transactions if own profile
      let creditsBalance = 0;
      if (isOwnProfile) {
        const { data: transactions } = await supabase
          .from('credit_transactions')
          .select('amount, type')
          .eq('user_id', userId);
        
        if (transactions) {
          creditsBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
        }
      }

      if (profileData) {
        setProfile({
          ...(profileData as any),
          credits_balance: creditsBalance,
        } as Profile);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowing(!!data);
    } catch (error: any) {
      console.error('Error checking follow status:', error);
    }
  };

  const checkFriendRequestStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setHasPendingRequest(!!data);
    } catch (error: any) {
      console.error('Error checking friend request status:', error);
    }
  };

  const toggleFollow = async () => {
    if (!user) return;

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        setIsFollowing(false);
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: userId,
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

  const sendFriendRequest = async () => {
    if (!user) return;

    try {
      await supabase.from('friend_requests').insert({
        sender_id: user.id,
        receiver_id: userId,
      });
      setHasPendingRequest(true);
      toast({
        title: 'Friend request sent',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const startConversation = async () => {
    if (!user || !userId) return;

    try {
      const { data: conversationId, error } = await supabase.rpc('create_conversation', {
        other_user_id: userId
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

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('posts').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Reload profile to show new avatar
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
    }
  };

  if (loading) {
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
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon" className="hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Button>
          {isOwnProfile && (
            <Button onClick={() => setShowSettings(true)} variant="ghost" size="icon" className="hover:bg-white/10">
              <Settings className="w-5 h-5 text-white" />
            </Button>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative">
        {/* Cover gradient */}
        <div className="h-40 bg-gradient-to-br from-purple-900/40 via-blue-900/30 to-black" />
        
        {/* Profile Info */}
        <div className="container mx-auto px-4 -mt-20 max-w-2xl">
          <div className="flex items-end gap-4 mb-6">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-black shadow-xl">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-4xl bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                  {profile.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label
                  htmlFor="profile-avatar-upload"
                  className="absolute bottom-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full p-2.5 cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                >
                  <Camera className="w-4 h-4 text-white" />
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

            {/* Name & Username */}
            <div className="flex-1 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {profile.display_name || 'Unknown'}
                </h1>
                {profile.is_premium && (
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-sm">@{profile.username || 'user'}</p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-gray-300 mb-6 leading-relaxed">{profile.bio}</p>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {isOwnProfile && (
              <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4 text-center backdrop-blur-sm">
                <Coins className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {isAdmin ? '∞' : profile.credits_balance}
                </p>
                <p className="text-xs text-gray-400">Credits</p>
              </div>
            )}
            
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4 text-center backdrop-blur-sm">
              <Eye className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{profile.total_views}</p>
              <p className="text-xs text-gray-400">Views</p>
            </div>
            
            <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-4 text-center backdrop-blur-sm">
              <Heart className="w-6 h-6 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{profile.followers_count}</p>
              <p className="text-xs text-gray-400">Followers</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-4 text-center backdrop-blur-sm">
              <UserPlus className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{profile.following_count}</p>
              <p className="text-xs text-gray-400">Following</p>
            </div>
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-3 mb-6">
              <Button
                onClick={toggleFollow}
                className={
                  isFollowing
                    ? 'flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg'
                }
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
              <Button
                onClick={hasPendingRequest ? undefined : sendFriendRequest}
                disabled={hasPendingRequest}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {hasPendingRequest ? 'Pending' : 'Add Friend'}
              </Button>
              <Button 
                onClick={startConversation}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
                size="icon"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Details Section */}
          <div className="space-y-4">
            {profile.about && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-white mb-3 text-base">About</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{profile.about}</p>
              </div>
            )}

            {profile.purpose && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-white mb-3 text-base">Purpose</h3>
                <p className="text-gray-300 text-sm capitalize">{profile.purpose.replace('_', ' ')}</p>
              </div>
            )}

            {profile.marital_status && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-white mb-3 text-base">Marital Status</h3>
                <p className="text-gray-300 text-sm capitalize">{profile.marital_status}</p>
              </div>
            )}

            {/* Social Links */}
            {(profile.instagram_url || profile.twitter_url || profile.linkedin_url || 
              profile.facebook_url || profile.tiktok_url || profile.youtube_url || profile.website_url) && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2 text-base">
                  <LinkIcon className="w-4 h-4" />
                  Social Links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.instagram_url && (
                    <a
                      href={profile.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium shadow-lg"
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

      {/* Settings Drawer */}
      <ProfileSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Profile;
