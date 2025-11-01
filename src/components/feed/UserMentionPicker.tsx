import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface UserMentionPickerProps {
  searchTerm: string;
  onSelect: (username: string) => void;
  show: boolean;
}

export const UserMentionPicker = ({ searchTerm, onSelect, show }: UserMentionPickerProps) => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (show && searchTerm) {
      searchUsers(searchTerm);
    } else {
      setUsers([]);
    }
  }, [searchTerm, show]);

  const searchUsers = async (term: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .limit(5);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  if (!show || users.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => onSelect(user.username || user.display_name || '')}
          className="w-full flex items-center space-x-3 px-4 py-2 hover:bg-gray-700 transition-colors text-left"
        >
          <Avatar className="w-8 h-8">
            <AvatarImage src={user.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-xs">
              {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white text-sm font-medium">
              {user.display_name || user.username}
            </p>
            {user.username && user.display_name && (
              <p className="text-gray-400 text-xs">@{user.username}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
