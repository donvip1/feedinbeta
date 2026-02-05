import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search, Users, UserPlus, Clock, Check, MessageCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  initialImageUrl?: string | null;
}

export const NewConversationModal = ({ open, onClose, onSelectUser, initialImageUrl }: NewConversationModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState<Record<string, FriendshipStatus>>({});
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('friends');

  useEffect(() => {
    if (open) {
      loadFriends();
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('friends');
    }
  }, [open]);

  // Debounced global search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchGlobalUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadFriends = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: acceptedRequests, error: requestsError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (requestsError) throw requestsError;

      const friendIds = acceptedRequests?.map((req) =>
        req.sender_id === user.id ? req.receiver_id : req.sender_id
      ) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', friendIds);

      if (profilesError) throw profilesError;
      setFriends(profiles || []);
    } catch (error: any) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGlobalUsers = async (query: string) => {
    if (!user || !query.trim()) return;

    setSearching(true);
    try {
      // Clean the query - remove @ if present
      const cleanQuery = query.replace(/^@/, '').trim();
      
      // Search by exact username or partial match
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .neq('id', user.id)
        .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
        .limit(20);

      if (error) throw error;
      
      setSearchResults(data || []);
      
      // Check friendship status for all results
      if (data && data.length > 0) {
        await checkFriendshipStatuses(data.map(p => p.id));
      }
    } catch (error: any) {
      console.error('Error searching users:', error);
      toast({
        title: 'Error searching users',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const checkFriendshipStatuses = async (userIds: string[]) => {
    if (!user?.id || userIds.length === 0) return;
    
    try {
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(
          userIds.map(id => 
            `and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`
          ).join(',')
        );

      const statuses: Record<string, FriendshipStatus> = {};
      userIds.forEach(id => {
        statuses[id] = 'none';
      });

      requests?.forEach(req => {
        const otherId = req.sender_id === user.id ? req.receiver_id : req.sender_id;
        if (req.status === 'accepted') {
          statuses[otherId] = 'accepted';
        } else if (req.status === 'pending') {
          statuses[otherId] = req.sender_id === user.id ? 'pending_sent' : 'pending_received';
        }
      });

      setFriendshipStatuses(statuses);
    } catch (error) {
      console.error('Error checking friendship statuses:', error);
    }
  };

  const sendFriendRequest = async (receiverId: string, receiverName: string) => {
    if (!user?.id) return;
    
    const existingStatus = friendshipStatuses[receiverId];
    if (existingStatus && existingStatus !== 'none') {
      const messages: Record<FriendshipStatus, string> = {
        'pending_sent': 'Friend request already sent',
        'pending_received': 'This user already sent you a request!',
        'accepted': 'You are already friends',
        'none': ''
      };
      toast({ title: messages[existingStatus] });
      return;
    }

    setSendingRequest(receiverId);
    try {
      // Deduct credits first (5 credits)
      const { error: creditError } = await supabase.functions.invoke('credit-deduction', {
        body: {
          action: 'friend_request',
          userId: user.id,
          targetUserId: receiverId,
        },
      });

      if (creditError) {
        toast({
          title: 'Insufficient credits',
          description: 'You need 5 credits to send a friend request',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.from('friend_requests').insert({
        sender_id: user.id,
        receiver_id: receiverId,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Request already exists',
            description: 'A request between you already exists',
          });
          return;
        }
        throw error;
      }

      // Notification is created automatically by database trigger

      // Update local status
      setFriendshipStatuses(prev => ({ ...prev, [receiverId]: 'pending_sent' }));

      toast({
        title: 'Friend request sent!',
        description: `Request sent to ${receiverName}. 5 credits deducted.`,
      });
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast({
        title: 'Error sending request',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(null);
    }
  };

  const acceptFriendRequest = async (senderId: string, senderName: string) => {
    if (!user?.id) return;

    setSendingRequest(senderId);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      // Notification is created automatically by database trigger

      // Update local status
      setFriendshipStatuses(prev => ({ ...prev, [senderId]: 'accepted' }));
      
      // Reload friends list
      await loadFriends();

      toast({
        title: 'Request accepted!',
        description: `You are now friends with ${senderName}`,
      });
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({
        title: 'Error accepting request',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(null);
    }
  };

  const declineFriendRequest = async (senderId: string, senderName: string) => {
    if (!user?.id) return;

    setSendingRequest(senderId);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      // Notification is created automatically by database trigger

      // Update local status
      setFriendshipStatuses(prev => ({ ...prev, [senderId]: 'none' }));

      toast({
        title: 'Request declined',
        description: `Declined request from ${senderName}`,
      });
    } catch (error: any) {
      console.error('Error declining request:', error);
      toast({
        title: 'Error declining request',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(null);
    }
  };

  const filteredFriends = friends.filter(
    u =>
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId);
    setSearchQuery('');
  };

  const renderUserCard = (u: User, isFriend: boolean) => {
    const status = friendshipStatuses[u.id] || (isFriend ? 'accepted' : 'none');
    const isProcessing = sendingRequest === u.id;

    return (
      <div
        key={u.id}
        className="w-full p-3 flex items-center gap-3 hover:bg-accent rounded-lg transition-colors"
      >
        <Avatar className="cursor-pointer" onClick={() => navigate(`/profile/${u.id}`)}>
          <AvatarImage src={u.avatar_url || ''} />
          <AvatarFallback>{u.display_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold truncate">{u.display_name || 'Unknown User'}</p>
          {u.username && (
            <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status === 'accepted' && (
            <Button
              size="sm"
              onClick={() => handleSelectUser(u.id)}
              className="gap-1"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </Button>
          )}
          
          {status === 'pending_sent' && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              Pending
            </Badge>
          )}
          
          {status === 'pending_received' && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="default"
                onClick={() => acceptFriendRequest(u.id, u.display_name || 'User')}
                disabled={isProcessing}
                className="gap-1"
              >
                <Check className="w-4 h-4" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => declineFriendRequest(u.id, u.display_name || 'User')}
                disabled={isProcessing}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          {status === 'none' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendFriendRequest(u.id, u.display_name || 'User')}
              disabled={isProcessing}
              className="gap-1"
            >
              <UserPlus className="w-4 h-4" />
              Add
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initialImageUrl ? 'Share Image With...' : 'New Conversation'}</DialogTitle>
        </DialogHeader>

        {initialImageUrl && (
          <div className="mb-4 p-2 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Sharing image:</p>
            <img src={initialImageUrl} alt="Shared" className="w-full max-h-32 object-contain rounded" />
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by username (without @)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="search" className="relative">
              Search
              {searchResults.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {searchResults.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[350px]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div className="text-muted-foreground">
                    {friends.length === 0 ? (
                      <>
                        <p className="font-medium">No friends yet</p>
                        <p className="text-sm mt-1">Search for users to add as friends</p>
                        <Button
                          variant="link"
                          onClick={() => setActiveTab('search')}
                          className="mt-2"
                        >
                          Search Users
                        </Button>
                      </>
                    ) : (
                      <p>No friends found matching "{searchQuery}"</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFriends.map((u) => renderUserCard(u, true))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="search" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[350px]">
              {searching ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : searchQuery.trim() === '' ? (
                <div className="text-center py-8 space-y-4">
                  <Search className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div className="text-muted-foreground">
                    <p className="font-medium">Search for users</p>
                    <p className="text-sm mt-1">Enter a username to find and add new friends</p>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div className="text-muted-foreground">
                    <p>No users found for "{searchQuery}"</p>
                    <p className="text-sm mt-1">Try searching with a different username</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((u) => renderUserCard(u, false))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};