import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Search, UserPlus, Check, X, ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import feedinLogo from '@/assets/feedin-logo.png';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  profiles: Profile;
}

const Friends = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadFriendRequests();
    loadFriends();
  }, [user, authLoading, navigate]);

  const loadFriendRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at
        `)
        .eq('receiver_id', user?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles separately
      if (data && data.length > 0) {
        const senderIds = data.map(req => req.sender_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', senderIds);

        if (profilesError) throw profilesError;

        // Combine data
        const requestsWithProfiles = data.map(req => ({
          ...req,
          profiles: profiles?.find(p => p.id === req.sender_id) || {
            id: req.sender_id,
            display_name: null,
            username: null,
            avatar_url: null,
            bio: null,
            followers_count: 0,
            following_count: 0,
          }
        }));

        setFriendRequests(requestsWithProfiles);
      } else {
        setFriendRequests([]);
      }
    } catch (error: any) {
      console.error('Error loading friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      // Get accepted friend requests where user is either sender or receiver
      const { data: acceptedRequests, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`);

      if (error) throw error;

      const friendIds = acceptedRequests?.map((req) =>
        req.sender_id === user?.id ? req.receiver_id : req.sender_id
      ) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);

      if (profilesError) throw profilesError;
      setFriends(profiles || []);
    } catch (error: any) {
      console.error('Error loading friends:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id)
        .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      toast.error('Error searching users', {
        description: error.message
      });
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!user) return;

    try {
      // 1. Create a friend request
      const { data: request, error: requestError } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
        })
        .select();

      if (requestError) throw requestError;

      // 2. Create a notification for the receiver
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'friend_request',
        message: `You have a new friend request from ${user.user_metadata.display_name || 'a user'}`,
        reference_id: request[0].id,
        is_read: false
      });

      if (notificationError) {
        // Even if notification fails, the request was created. 
        // You might want to handle this case, e.g., by logging it.
        console.error("Failed to create notification:", notificationError);
      }

      toast.success('Message request sent!');

    } catch (error: any) {
      toast.error('Error sending message request', {
        description: error.message,
      });
    }
  };


  const respondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(status === 'accepted' ? 'Message request accepted' : 'Message request rejected');

      loadFriendRequests();
      if (status === 'accepted') {
        loadFriends();
      }
    } catch (error: any) {
      toast.error('Error responding to request', {
        description: error.message
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate('/feed')}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={feedinLogo} alt="FEEDIN" className="w-10 h-10" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Friends
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => navigate('/settings')}
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <SettingsIcon className="w-4 h-4" />
              </Button>
              <NotificationBell />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {friendRequests.length > 0 && (
                <span className="ml-2 bg-primary text-white rounded-full px-2 py-0.5 text-xs">
                  {friendRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-6 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No friends yet</p>
                <p className="text-sm text-gray-500">Search for users to send message requests</p>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 cursor-pointer"
                  onClick={() => navigate(`/profile/${friend.id}`)}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={friend.avatar_url || ''} />
                    <AvatarFallback>{friend.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{friend.display_name || 'Unknown'}</p>
                    <p className="text-sm text-gray-400">@{friend.username || 'user'}</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    {friend.followers_count} followers
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-6 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : friendRequests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No pending message requests</p>
              </div>
            ) : (
              friendRequests.map((request) => (
                <div key={request.id} className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={request.profiles.avatar_url || ''} />
                    <AvatarFallback>{request.profiles.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{request.profiles.display_name || 'Unknown'}</p>
                    <p className="text-sm text-gray-400">@{request.profiles.username || 'user'}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => respondToRequest(request.id, 'accepted')}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => respondToRequest(request.id, 'rejected')}
                      className="border-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="search" className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="pl-10 bg-gray-900 border-gray-800"
              />
            </div>

            {searching ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  {searchQuery ? 'No users found' : 'Search for users to connect'}
                </p>
              </div>
            ) : (
              searchResults.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={profile.avatar_url || ''} />
                    <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/profile/${profile.id}`)}
                  >
                    <p className="font-semibold">{profile.display_name || 'Unknown'}</p>
                    <p className="text-sm text-gray-400">@{profile.username || 'user'}</p>
                    {profile.bio && (
                      <p className="text-sm text-gray-500 mt-1">{profile.bio}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => sendFriendRequest(profile.id)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav onQuickActionClick={() => {}} />
    </div>
  );
};

export default Friends;
