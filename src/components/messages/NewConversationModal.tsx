import React, { useState, useEffect } from 'react';
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
import { Search } from 'lucide-react';

interface User {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  initialImageUrl?: string | null;
}

export const NewConversationModal = ({ open, onClose, onSelectUser, initialImageUrl }: NewConversationModalProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .neq('id', user.id)
        .limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    u =>
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = (userId: string) => {
    onSelectUser(userId);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border max-w-md">
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
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-accent rounded-lg transition-colors"
                >
                  <Avatar>
                    <AvatarImage src={u.avatar_url || ''} />
                    <AvatarFallback>{u.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-semibold">{u.display_name || 'Unknown User'}</p>
                    {u.username && (
                      <p className="text-sm text-muted-foreground">@{u.username}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
