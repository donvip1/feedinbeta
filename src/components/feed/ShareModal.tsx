import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Share2, Link2, Download, Send, Users, ImageIcon, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postData?: {
    media_url?: string;
    media_type?: string;
    content?: string;
  };
  onSavePost?: () => void;
  isSaved?: boolean;
}

export default function ShareModal({ isOpen, onClose, postId, postData, onSavePost, isSaved }: ShareModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showFriends, setShowFriends] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      loadGroups();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          sender_id,
          receiver_id,
          sender:profiles!friend_requests_sender_id_fkey(id, display_name, username, avatar_url),
          receiver:profiles!friend_requests_receiver_id_fkey(id, display_name, username, avatar_url)
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (error) throw error;

      const friendsList = data?.map(req => {
        const friend = req.sender_id === user.id ? req.receiver : req.sender;
        return friend;
      }) || [];

      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadGroups = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group:groups(id, name, avatar_url, member_count)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setGroups(data?.map(m => m.group).filter(Boolean) || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleSharePost = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out this post',
        url: `${window.location.origin}/post/${postId}`
      });
    } else {
      toast({ title: 'Sharing not supported on this device' });
    }
  };


  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    toast({ 
      title: 'Link copied!',
      description: 'Post link copied to clipboard'
    });
    setTimeout(() => onClose(), 1000);
  };

  const handleDownload = () => {
    if (postData?.media_url) {
      const link = document.createElement('a');
      link.href = postData.media_url;
      link.download = `feedin-${postId}`;
      link.click();
      toast({ title: 'Download started' });
    }
    onClose();
  };

  const handleShareToStory = async () => {
    if (!user || !postData?.media_url) return;
    
    try {
      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: postData.media_url,
        media_type: postData.media_type || 'image',
      });

      if (error) throw error;

      toast({ 
        title: 'Shared to your story!',
        description: 'Your story will expire in 24 hours'
      });
      onClose();
    } catch (error) {
      toast({ 
        title: 'Error sharing to story',
        variant: 'destructive'
      });
    }
  };

  const handleShareToFriend = async (friendId: string) => {
    if (!user) return;

    try {
      const { data: conversation } = await supabase.rpc('create_conversation', {
        other_user_id: friendId
      });

      if (conversation) {
        await supabase.from('messages').insert({
          conversation_id: conversation,
          sender_id: user.id,
          content: `Shared a post: ${window.location.origin}/post/${postId}`,
          media_type: 'text',
        });

        toast({ title: 'Shared to friend!' });
        onClose();
      }
    } catch (error) {
      toast({ 
        title: 'Error sharing to friend',
        variant: 'destructive'
      });
    }
  };

  const handleShareToGroup = async (groupId: string) => {
    if (!user) return;

    try {
      // Insert as a group message (group chats use group_messages table)
      const { error } = await supabase.from('group_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        content: `Shared a post: ${window.location.origin}/post/${postId}`,
        media_url: postData?.media_url || null,
        media_type: postData?.media_url ? (postData?.media_type || 'image') : null,
      });

      if (error) throw error;

      toast({ title: 'Shared to group!' });
      onClose();
    } catch (error) {
      console.error('Error sharing to group:', error);
      toast({ 
        title: 'Error sharing to group',
        variant: 'destructive'
      });
    }
  };

  const filteredFriends = friends.filter(f => 
    f?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showFriends) {
    return (
      <Sheet open={isOpen} onOpenChange={() => setShowFriends(false)}>
        <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-3">Share to Friend</h3>
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {filteredFriends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleShareToFriend(friend.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={friend.avatar_url} />
                    <AvatarFallback>{friend.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{friend.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{friend.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  if (showGroups) {
    return (
      <Sheet open={isOpen} onOpenChange={() => setShowGroups(false)}>
        <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-3">Share to Group</h3>
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleShareToGroup(group.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={group.avatar_url} />
                    <AvatarFallback>{group.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{group.name}</p>
                    <p className="text-sm text-muted-foreground">{group.member_count} members</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl p-0 pb-6">
        <div className="space-y-1 p-4">
          {postData?.media_url && (
            <Button
              onClick={handleShareToStory}
              className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
              variant="ghost"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="font-medium">Share to Story</span>
            </Button>
          )}

          <Button
            onClick={() => setShowFriends(true)}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Send className="w-5 h-5" />
            <span className="font-medium">Send to Friend</span>
          </Button>

          <Button
            onClick={() => setShowGroups(true)}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Share to Group</span>
          </Button>

          <Button
            onClick={handleSharePost}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Share2 className="w-5 h-5" />
            <span className="font-medium">Share Externally</span>
          </Button>


          <Button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Link2 className="w-5 h-5" />
            <span className="font-medium">Copy Link</span>
          </Button>

          {onSavePost && (
            <Button
              onClick={() => {
                onSavePost();
                onClose();
              }}
              className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
              variant="ghost"
            >
              <Bookmark className={isSaved ? "w-5 h-5 fill-primary text-primary" : "w-5 h-5"} />
              <span className="font-medium">{isSaved ? 'Remove from Saved' : 'Save Post'}</span>
            </Button>
          )}

          {postData?.media_url && (
            <Button
              onClick={handleDownload}
              className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary"
              variant="ghost"
            >
              <Download className="w-5 h-5" />
              <span className="font-medium">Download</span>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
