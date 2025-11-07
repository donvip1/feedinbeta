import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { ArrowLeft, Settings, Coins, Eye, Crown, UserPlus, MessageCircle, Heart, Camera, Users } from "lucide-react";
import { BottomNav } from "@/components/navigation/BottomNav";

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
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
}

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowingMe, setIsFollowingMe] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (userId && user) {
      if (isOwnProfile) {
        if (user.email) {
          checkAdminStatus(user.email);
        }
      } else {
        checkFollowStatus();
        checkIfFollowingMe();
        checkFriendRequestStatus();
      }
    }
  }, [userId, user, isOwnProfile]);

  const checkAdminStatus = async (email: string) => {
    const adminEmails = ["viplearn4free@gmail.com", "cryptosvip@gmail.com", "myconnectmate@gmail.com"];
    setIsAdmin(adminEmails.includes(email.toLowerCase()));
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      let creditsBalance = 0;
      if (isOwnProfile) {
        const { data: transactions } = await supabase
          .from("credit_transactions")
          .select("amount, type")
          .eq("user_id", userId);

        if (transactions) {
          creditsBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
        }
      }

      setProfile({
        ...profileData,
        credits_balance: creditsBalance,
      } as Profile);
    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!user || !userId) return;

    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setIsFollowing(!!data);
    } catch (error: any) {
      console.error("Error checking follow status:", error);
    }
  };

  const checkIfFollowingMe = async () => {
    if (!user || !userId) return;

    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("following_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setIsFollowingMe(!!data);
    } catch (error: any) {
      console.error("Error checking if following me:", error);
    }
  };

  const checkFriendRequestStatus = async () => {
    if (!user || !userId) return;

    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", user.id)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setHasPendingRequest(!!data);
    } catch (error: any) {
      console.error("Error checking friend request status:", error);
    }
  };

  const toggleFollow = async () => {
    if (!user || !userId) return;

    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
        setIsFollowing(false);
      } else {
        await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: userId,
        });
        setIsFollowing(true);
      }
      loadProfile(); // Refresh profile to update counts
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendFriendRequest = async () => {
    if (!user || !userId) return;

    try {
      await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: userId,
      });
      setHasPendingRequest(true);
      toast({
        title: "Friend request sent",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startConversation = async () => {
    if (!user || !userId) return;

    try {
      const { data: conversationId, error } = await supabase.rpc("create_conversation", {
        other_user_id: userId,
      });

      if (error) throw error;

      navigate(`/messages?conversation=${conversationId}`);
    } catch (error: any) {
      toast({
        title: "Unable to start conversation",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await loadProfile();

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been changed",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading image",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `banner-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ banner_url: data.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await loadProfile();

      toast({
        title: "Banner updated",
        description: "Your profile banner has been changed",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading banner",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <p className="text-gray-400">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {isOwnProfile && (
            <Button
              onClick={() => setShowSettings(true)}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      {/* Banner Image */}
      <div className="relative w-full h-48 bg-gradient-to-br from-gray-900 to-gray-800">
        {profile?.banner_url ? (
          <img src={profile.banner_url} alt="Profile banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        {isOwnProfile && (
          <label
            htmlFor="banner-upload"
            className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-full p-3 cursor-pointer hover:bg-black/80 transition-colors"
          >
            <Camera className="w-5 h-5 text-white" />
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      <div className="container mx-auto px-4 -mt-16 max-w-2xl relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <Avatar className="w-32 h-32 mb-4 border-4 border-black">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback className="text-4xl bg-gray-800">{profile.display_name?.[0] || "U"}</AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <label
                htmlFor="profile-avatar-upload"
                className="absolute bottom-4 right-0 bg-primary rounded-full p-3 cursor-pointer hover:bg-primary/80 transition-colors"
              >
                <Camera className="w-5 h-5 text-primary-foreground" />
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

          <h1 className="text-2xl font-bold mb-1">{profile.display_name || "Unknown"}</h1>
          <p className="text-gray-400 mb-2">@{profile.username || "user"}</p>

          {profile.is_premium && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 mb-2">
              <Crown className="w-3 h-3 mr-1" />
              Premium Member
            </Badge>
          )}

          {profile.bio && <p className="text-center text-gray-300 mt-2 max-w-md">{profile.bio}</p>}

          {isFollowingMe && !isOwnProfile && (
            <Badge variant="secondary" className="mt-2">
              Follows you
            </Badge>
          )}
        </div>

        <div className={`grid gap-3 mb-6 grid-cols-2 ${isOwnProfile ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {isOwnProfile && (
            <Card className="bg-gray-900 border-gray-800 p-4 text-center">
              <Coins className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{isAdmin ? "∞" : profile.credits_balance}</p>
              <p className="text-xs text-gray-400">{isAdmin ? "Unlimited Credits" : "Credits"}</p>
            </Card>
          )}

          <Card className="bg-gray-900 border-gray-800 p-4 text-center">
            <Eye className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{profile.total_views}</p>
            <p className="text-xs text-gray-400">Total Views</p>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-4 text-center">
            <Heart className="w-6 h-6 text-pink-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{profile.followers_count}</p>
            <p className="text-xs text-gray-400">Followers</p>
          </Card>

          <Card className="bg-gray-900 border-gray-800 p-4 text-center">
            <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{profile.following_count}</p>
            <p className="text-xs text-gray-400">Following</p>
          </Card>
        </div>

        {!isOwnProfile && (
          <div className="flex space-x-2 mb-6">
            <Button
              onClick={toggleFollow}
              className={
                isFollowing
                  ? "flex-1 bg-gray-800 hover:bg-gray-700 text-white"
                  : "flex-1 bg-gradient-to-r from-pink-500 to-blue-500 text-white"
              }
            >
              {isFollowingMe && isFollowing ? "Unfollow" : isFollowing ? "Following" : "Follow"}
            </Button>
            <Button
              onClick={hasPendingRequest ? undefined : sendFriendRequest}
              disabled={hasPendingRequest}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {hasPendingRequest ? "Request Sent" : "Add Friend"}
            </Button>
            <Button onClick={startConversation} className="bg-gray-800 hover:bg-gray-700 text-white">
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {profile.about && (
          <Card className="bg-gray-900 border-gray-800 p-4 mb-4">
            <h3 className="font-semibold mb-2">About</h3>
            <p className="text-gray-300 text-sm">{profile.about}</p>
          </Card>
        )}

        {profile.purpose && (
          <Card className="bg-gray-900 border-gray-800 p-4 mb-4">
            <h3 className="font-semibold mb-2">Purpose</h3>
            <p className="text-gray-300 text-sm">{profile.purpose}</p>
          </Card>
        )}

        {profile.marital_status && (
          <Card className="bg-gray-900 border-gray-800 p-4 mb-4">
            <h3 className="font-semibold mb-2">Marital Status</h3>
            <p className="text-gray-300 text-sm capitalize">{profile.marital_status}</p>
          </Card>
        )}
      </div>

      <ProfileSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <BottomNav />
    </div>
  );
};

export default Profile;
