import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { AtSign } from 'lucide-react';

interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

interface UserMentionToolProps {
  onMention: (username: string) => void;
}

export function UserMentionTool({ onMention }: UserMentionToolProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery) {
      searchUsers();
    } else {
      loadFriendsAndFollowers();
    }
  }, [searchQuery]);

  const loadFriendsAndFollowers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get friends
      const { data: friendsData } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      // Get followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

      const userIds = new Set<string>();
      
      friendsData?.forEach((f) => {
        userIds.add(f.sender_id === user.id ? f.receiver_id : f.sender_id);
      });
      
      followersData?.forEach((f) => {
        userIds.add(f.follower_id === user.id ? f.following_id : f.follower_id);
      });

      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', Array.from(userIds))
          .limit(20);

        setUsers(usersData || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!user || !searchQuery) return;
    setLoading(true);

    try {
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .neq('id', user.id)
        .limit(20);

      setUsers(usersData || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background/95 backdrop-blur rounded-lg p-4 space-y-4">
      <div className="relative">
        <AtSign className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users to mention..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No users found
            </p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => onMention(u.username || u.display_name)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback>
                    {(u.display_name || u.username || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
