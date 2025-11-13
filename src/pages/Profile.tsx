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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {isOwnProfile && (
            <Button onClick={() => setShowSettings(true)} variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative">
        {/* Cover gradient */}
        <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        
        {/* Profile Info */}
        <div className="container mx-auto px-4 -mt-16 max-w-2xl">
          <div className="flex items-end gap-4 mb-6">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-28 h-28 border-4 border-background">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-3xl bg-card">
                  {profile.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label
                  htmlFor="profile-avatar-upload"
                  className="absolute bottom-0 right-0 bg-primary rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
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

            {/* Name & Username */}
            <div className="flex-1 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">
                  {profile.display_name || 'Unknown'}
                </h1>
                {profile.is_premium && (
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">@{profile.username || 'user'}</p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-foreground mb-6">{profile.bio}</p>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {isOwnProfile && (
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <Coins className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-foreground">
                  {isAdmin ? '∞' : profile.credits_balance}
                </p>
                <p className="text-xs text-muted-foreground">Credits</p>
              </div>
            )}
            
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <Eye className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{profile.total_views}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <Heart className="w-5 h-5 text-pink-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{profile.followers_count}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <UserPlus className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{profile.following_count}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-2 mb-6">
              <Button
                onClick={toggleFollow}
                variant={isFollowing ? "outline" : "default"}
                className="flex-1"
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
              <Button
                onClick={hasPendingRequest ? undefined : sendFriendRequest}
                disabled={hasPendingRequest}
                variant="outline"
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {hasPendingRequest ? 'Pending' : 'Add Friend'}
              </Button>
              <Button onClick={startConversation} variant="outline" size="icon">
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Details Section */}
          <div className="space-y-4">
            {profile.about && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">About</h3>
                <p className="text-foreground text-sm leading-relaxed">{profile.about}</p>
              </div>
            )}

            {profile.purpose && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">Purpose</h3>
                <p className="text-foreground text-sm capitalize">{profile.purpose.replace('_', ' ')}</p>
              </div>
            )}

            {profile.marital_status && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">Marital Status</h3>
                <p className="text-foreground text-sm capitalize">{profile.marital_status}</p>
              </div>
            )}

            {/* Social Links */}
            {(profile.instagram_url || profile.twitter_url || profile.linkedin_url || 
              profile.facebook_url || profile.tiktok_url || profile.youtube_url || profile.website_url) && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Social Links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.instagram_url && (
                    <a
                      href={profile.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:opacity-90 transition-opacity text-sm"
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
                      className="flex items-center gap-2 px-3 py-2 bg-blue-400 text-white rounded-md hover:opacity-90 transition-opacity text-sm"
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
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:opacity-90 transition-opacity text-sm"
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
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:opacity-90 transition-opacity text-sm"
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
                      className="flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity text-sm"
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
                      className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-md hover:opacity-90 transition-opacity text-sm"
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
                      className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity text-sm"
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
