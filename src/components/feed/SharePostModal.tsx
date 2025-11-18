import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Share2, Users, MessageCircle, Bookmark } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface SharePostModalProps {
  open: boolean;
  onClose: () => void;
  post: {
    id: string;
    content: string | null;
    media_url: string | null;
    user_id: string;
  };
}

interface Friend {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
}

export function SharePostModal({ open, onClose, post }: SharePostModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'friends' | 'groups' | 'story'>('friends');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadFriends();
      loadGroups();
    }
  }, [open, user]);

  const loadFriends = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles:following_id (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('follower_id', user.id);

      if (error) throw error;
      
      const friendsList = data?.map(item => {
        const profile = item.profiles as any;
        return {
          id: profile?.id || item.following_id,
          display_name: profile?.display_name,
          username: profile?.username,
          avatar_url: profile?.avatar_url,
        } as Friend;
      }) || [];
      
      setFriends(friendsList);
    } catch (error: any) {
      console.error('Error loading friends:', error);
    }
  };

  const loadGroups = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            avatar_url,
            member_count
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const groupsList = data?.map(item => {
        const group = item.groups as any;
        return {
          id: group?.id || item.group_id,
          name: group?.name || 'Unknown Group',
          avatar_url: group?.avatar_url,
          member_count: group?.member_count || 0,
        } as Group;
      }) || [];
      
      setGroups(groupsList);
    } catch (error: any) {
      console.error('Error loading groups:', error);
    }
  };

  const handleShareToStory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Create a story that references the post
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        feed_id: '', // Auto-generated
        content: post.content,
        media_url: post.media_url,
        media_type: post.media_url?.includes('.mp4') ? 'video' : 'image',
        post_type: 'story',
        status: 'active',
      });

      if (error) throw error;

      // Record share
      await supabase.from('post_shares').insert({
        post_id: post.id,
        user_id: user.id,
        share_type: 'story',
      });

      toast({ title: 'Shared to story!' });
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleShareToFriend = async (friendId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      // Get or create conversation
      const { data: existingConv } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
        .single();

      let conversationId = existingConv?.conversation_id;

      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({})
          .select()
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;

        await supabase.from('conversation_participants').insert([
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: friendId },
        ]);
      }

      // Send message with post link
      const postLink = `${window.location.origin}/post/${post.id}`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `Check out this post: ${postLink}`,
      });

      // Record share
      await supabase.from('post_shares').insert({
        post_id: post.id,
        user_id: user.id,
        share_type: 'dm',
        shared_to_user_id: friendId,
      });

      toast({ title: 'Shared to friend!' });
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleShareToGroup = async (groupId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      // Create a group post
      const postLink = `${window.location.origin}/post/${post.id}`;
      await supabase.from('group_posts').insert({
        group_id: groupId,
        user_id: user.id,
        content: `Check out this post: ${postLink}\n\n${post.content || ''}`,
        media_url: post.media_url,
        media_type: post.media_url?.includes('.mp4') ? 'video' : 'image',
      });

      // Record share
      await supabase.from('post_shares').insert({
        post_id: post.id,
        user_id: user.id,
        share_type: 'group',
      });

      toast({ title: 'Shared to group!' });
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(f =>
    (f.display_name?.toLowerCase() || f.username?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={selectedTab === 'story' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('story')}
            className="flex-1"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Story
          </Button>
          <Button
            variant={selectedTab === 'friends' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('friends')}
            className="flex-1"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Friends
          </Button>
          <Button
            variant={selectedTab === 'groups' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('groups')}
            className="flex-1"
          >
            <Users className="w-4 h-4 mr-2" />
            Groups
          </Button>
        </div>

        {selectedTab === 'story' ? (
          <div className="text-center py-8">
            <Share2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Share to Your Story</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This post will appear in your story for 24 hours
            </p>
            <Button onClick={handleShareToStory} disabled={loading} className="w-full">
              {loading ? 'Sharing...' : 'Share to Story'}
            </Button>
          </div>
        ) : (
          <>
            <Input
              placeholder={`Search ${selectedTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-4"
            />

            <ScrollArea className="h-[300px]">
              {selectedTab === 'friends' ? (
                <div className="space-y-2">
                  {filteredFriends.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No friends found</p>
                  ) : (
                    filteredFriends.map((friend) => (
                      <Button
                        key={friend.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleShareToFriend(friend.id)}
                        disabled={loading}
                      >
                        <Avatar className="w-10 h-10 mr-3">
                          <AvatarImage src={friend.avatar_url || ''} />
                          <AvatarFallback>
                            {(friend.display_name || friend.username || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {friend.display_name || friend.username || 'Unknown'}
                        </span>
                      </Button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGroups.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No groups found</p>
                  ) : (
                    filteredGroups.map((group) => (
                      <Button
                        key={group.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleShareToGroup(group.id)}
                        disabled={loading}
                      >
                        <Avatar className="w-10 h-10 mr-3">
                          <AvatarImage src={group.avatar_url || ''} />
                          <AvatarFallback>
                            <Users className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="font-medium">{group.name}</p>
                          <p className="text-xs text-muted-foreground">{group.member_count} members</p>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
