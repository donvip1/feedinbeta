import { Sheet, SheetContent } from '@/components/ui/sheet';
import { 
  Share2, 
  Link2, 
  Download, 
  Send, 
  Users, 
  ImageIcon, 
  Bookmark,
  X,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { addWatermarkToMedia } from '@/lib/watermark-utils';


interface MobileShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postData?: {
    media_url?: string;
    media_type?: string;
    content?: string;
  };
  posterInfo?: {
    displayName: string;
    username: string;
  };
  onSavePost?: () => void;
  isSaved?: boolean;
}

export default function MobileShareSheet({ 
  isOpen, 
  onClose, 
  postId, 
  postData, 
  posterInfo,
  onSavePost, 
  isSaved 
}: MobileShareSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<'main' | 'friends' | 'groups'>('main');
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      loadGroups();
      setView('main');
      setSearchQuery('');
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

  const handleShareExternal = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out this post on feedin',
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
    setTimeout(() => onClose(), 800);
  };

  const handleDownload = async () => {
    if (!postData?.media_url) {
      toast({ title: 'No media to download', variant: 'destructive' });
      return;
    }

    setIsDownloading(true);
    try {
      // Add watermark with poster info
      const watermarkedBlob = await addWatermarkToMedia(
        postData.media_url,
        posterInfo?.displayName || 'Unknown',
        posterInfo?.username || 'user',
        postData.media_type?.includes('video') ? 'video' : 'image'
      );

      // Create download link
      const url = window.URL.createObjectURL(watermarkedBlob);
      const a = document.createElement('a');
      a.href = url;
      const extension = postData.media_type?.includes('video') ? 'mp4' : 'jpg';
      a.download = `feedin-${postId}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: 'Download complete!' });
      onClose();
    } catch (error) {
      console.error('Download error:', error);
      // Fallback to direct download without watermark
      const link = document.createElement('a');
      link.href = postData.media_url;
      link.download = `feedin-${postId}`;
      link.click();
      toast({ title: 'Download started' });
      onClose();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareToStory = async () => {
    if (!user || !postData?.media_url) {
      toast({ title: 'Cannot share to story', variant: 'destructive' });
      return;
    }
    
    try {
      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: postData.media_url,
        media_type: postData.media_type || 'image',
      });

      if (error) throw error;

      toast({ 
        title: 'Added to your story!',
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

        toast({ title: 'Sent to friend!' });
        onClose();
      }
    } catch (error) {
      toast({ 
        title: 'Error sending to friend',
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

  // Action items for the main sheet view - WhatsApp/Telegram style horizontal scroll
  const shareActions = [
    ...(postData?.media_url ? [{
      icon: ImageIcon,
      label: 'Story',
      onClick: handleShareToStory,
      color: 'bg-gradient-to-br from-pink-500 to-orange-400'
    }] : []),
    {
      icon: Send,
      label: 'Friends',
      onClick: () => setView('friends'),
      color: 'bg-gradient-to-br from-blue-500 to-cyan-400'
    },
    {
      icon: Users,
      label: 'Groups',
      onClick: () => setView('groups'),
      color: 'bg-gradient-to-br from-green-500 to-emerald-400'
    },
    {
      icon: Share2,
      label: 'More',
      onClick: handleShareExternal,
      color: 'bg-gradient-to-br from-purple-500 to-violet-400'
    },
  ];

  // Friends list view
  if (view === 'friends') {
    return (
      <Sheet open={isOpen} onOpenChange={() => setView('main')}>
        <SheetContent side="bottom" className="h-[70vh] p-0 flex flex-col rounded-t-3xl">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={() => setView('main')} className="p-2 -ml-2 text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-lg">Send to Friend</h3>
            <div className="w-9" />
          </div>
          <div className="px-4 py-2">
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/50"
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredFriends.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No friends found</p>
              ) : (
                filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleShareToFriend(friend.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={friend.avatar_url} />
                      <AvatarFallback>{friend.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{friend.display_name}</p>
                      <p className="text-sm text-muted-foreground">@{friend.username}</p>
                    </div>
                    <Send className="w-5 h-5 text-primary" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  // Groups list view
  if (view === 'groups') {
    return (
      <Sheet open={isOpen} onOpenChange={() => setView('main')}>
        <SheetContent side="bottom" className="h-[70vh] p-0 flex flex-col rounded-t-3xl">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={() => setView('main')} className="p-2 -ml-2 text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-lg">Share to Group</h3>
            <div className="w-9" />
          </div>
          <div className="px-4 py-2">
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/50"
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredGroups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No groups found</p>
              ) : (
                filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleShareToGroup(group.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={group.avatar_url} />
                      <AvatarFallback>{group.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.member_count} members</p>
                    </div>
                    <Users className="w-5 h-5 text-primary" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  // Main share sheet - WhatsApp/Telegram style
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl p-0 pb-safe">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Quick share actions - horizontal scroll */}
        <div className="px-4 pb-4 overflow-x-auto">
          <div className="flex gap-4 pb-2 px-1">
            {shareActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="flex flex-col items-center gap-2 min-w-[64px]"
              >
                <div className={`w-14 h-14 rounded-full ${action.color} flex items-center justify-center shadow-lg active:scale-95 transition-transform`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-4" />

        {/* Action list */}
        <div className="p-2 space-y-1">
          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Link2 className="w-5 h-5 text-foreground" />
            </div>
            <span className="font-medium">Copy Link</span>
          </button>

          {/* Save Post */}
          {onSavePost && (
            <button
              onClick={() => {
                onSavePost();
                onClose();
              }}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Bookmark className={isSaved ? "w-5 h-5 fill-primary text-primary" : "w-5 h-5 text-foreground"} />
              </div>
              <span className="font-medium">{isSaved ? 'Remove from Saved' : 'Save Post'}</span>
            </button>
          )}

          {/* Download with Watermark */}
          {postData?.media_url && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                {isDownloading ? (
                  <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                ) : (
                  <Download className="w-5 h-5 text-primary-foreground" />
                )}
              </div>
              <span className="font-medium">Download</span>
            </button>
          )}
        </div>

        {/* Bottom padding for safe area */}
        <div className="h-4" />
      </SheetContent>
    </Sheet>
  );
}
