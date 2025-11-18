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
import { FollowersModal } from '@/components/profile/FollowersModal';
import { ProfileImageModal } from '@/components/profile/ProfileImageModal';
import { CoverImageCropper } from '@/components/profile/CoverImageCropper';
import { AvatarImageCropper } from '@/components/profile/AvatarImageCropper';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Settings, Eye, Crown, MessageCircle, Heart, Camera, Instagram, Twitter, Linkedin, Facebook, Youtube, Mic, Link as LinkIcon, Bookmark, FileText, Upload } from 'lucide-react';
import { PostsGrid } from '@/components/profile/PostsGrid';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio: string | null;
  status: string | null;
  about: string | null;
  purpose: string | null;
  marital_status: string | null;
  total_views: number;
  is_premium: boolean;
  post_count: number;
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [isFollowingMe, setIsFollowingMe] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [tempCoverImageUrl, setTempCoverImageUrl] = useState<string>('');
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [tempAvatarImageUrl, setTempAvatarImageUrl] = useState<string>('');

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (!user) {
      // Store the current path to redirect back after auth
      sessionStorage.setItem('redirectAfterAuth', window.location.pathname);
      navigate('/welcome');
      return;
    }
    
    if (userId) {
      loadProfile();
      if (isOwnProfile && user?.email) {
        checkAdminStatus(user.email);
      }
      if (!isOwnProfile && user) {
        checkFollowStatus();
        checkIfFollowingMe();
        checkFriendRequestStatus();
      }
    }
  }, [userId, user?.id]);

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
          website_url,
          cover_url
        `)
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!profileData) {
        toast({
          title: 'Profile not found',
          description: 'This profile does not exist.',
          variant: 'destructive',
        });
        navigate('/feed');
        return;
      }

      // Get post count
      const { data: postCount } = await supabase
        .rpc('get_user_post_count', { user_uuid: userId });

      if (profileData) {
        setProfile({
          ...(profileData as any),
          post_count: postCount || 0,
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
    if (!user || !userId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowing(!!data);
    } catch (error: any) {
      console.error('Error checking follow status:', error);
    }
  };

  const checkIfFollowingMe = async () => {
    if (!user || !userId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', userId)
        .eq('following_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setIsFollowingMe(!!data);
    } catch (error: any) {
      console.error('Error checking if following me:', error);
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

  const requestChat = async () => {
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
              <Button 
                onClick={() => navigate(-1)} 
                variant="ghost" 
                size="icon" 
                className="bg-background/40 backdrop-blur-md hover:bg-background/60 border border-background/20 shadow-lg"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </Button>
              {isOwnProfile && (
                <Button 
                  onClick={() => setShowSettings(true)} 
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
              {profile.is_premium && (
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

          {/* Followers, Following & Views - Same line, Centered */}
          <div className="flex gap-8 mb-6 justify-center">
            <button
              onClick={() => { setFollowersModalTab('followers'); setShowFollowersModal(true); }}
              className="flex flex-col items-center cursor-pointer hover:opacity-80 transition"
            >
              <p className="text-2xl font-bold text-foreground">{profile.followers_count}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>

            <button
              onClick={() => { setFollowersModalTab('following'); setShowFollowersModal(true); }}
              className="flex flex-col items-center cursor-pointer hover:opacity-80 transition"
            >
              <p className="text-2xl font-bold text-foreground">{profile.following_count}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>

            <div className="flex flex-col items-center">
              <p className="text-2xl font-bold text-foreground">{profile.total_views}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
          </div>

          {/* Bio - Centered */}
          {profile.bio && (
            <p className="text-foreground mb-6 leading-relaxed text-center">{profile.bio}</p>
          )}

          {/* Action Buttons - Centered, BEFORE Posts */}
          {isOwnProfile ? (
            <div className="flex gap-3 mb-6 justify-center max-w-md mx-auto">
              <Button
                onClick={() => navigate('/saved')}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-lg"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Saved Posts
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 mb-6 justify-center max-w-md mx-auto">
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
              <Button
                onClick={requestChat}
                className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Request Chat
              </Button>
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
            <PostsGrid userId={userId || ''} />
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            {profile.about && (
              <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-foreground mb-3 text-base">About</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{profile.about}</p>
              </div>
            )}

            {profile.purpose && (
              <div className="bg-card/50 border border-border rounded-xl p-5 backdrop-blur-sm">
                <h3 className="font-semibold text-foreground mb-3 text-base">Purpose</h3>
                <p className="text-muted-foreground text-sm capitalize">{profile.purpose.replace('_', ' ')}</p>
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
      
      {/* Followers/Following Modal */}
      <FollowersModal
        open={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={userId || ''}
        defaultTab={followersModalTab}
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
      
      <BottomNav />
    </div>
  );
};

export default Profile;
