import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface UserMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  conversationId: string;
}

export const UserMentionInput = ({
  value,
  onChange,
  onKeyDown,
  disabled,
  placeholder,
  conversationId,
}: UserMentionInputProps) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartPos = useRef<number>(0);

  useEffect(() => {
    loadConversationParticipants();
  }, [conversationId]);

  const loadConversationParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('user_id, participant:profiles!conversation_participants_user_id_fkey(*)')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      const participantsList = data?.map(p => ({
        id: p.participant.id,
        display_name: p.participant.display_name,
        username: p.participant.username,
        avatar_url: p.participant.avatar_url,
      })) || [];

      setUsers(participantsList);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(position);

    // Check for @ mention
    const textBeforeCursor = newValue.slice(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Check if there's a space after @ (which means mention is complete)
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        mentionStartPos.current = lastAtIndex;
        setSelectedIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: User) => {
    const beforeMention = value.slice(0, mentionStartPos.current);
    const afterMention = value.slice(cursorPosition);
    const mentionText = `@${user.username || user.display_name} `;
    
    const newValue = beforeMention + mentionText + afterMention;
    onChange(newValue);
    setShowMentions(false);
    
    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
      }
    }
    
    onKeyDown?.(e);
  };

  const filteredUsers = users.filter(user => {
    const searchTerm = mentionQuery.toLowerCase();
    return (
      user.display_name?.toLowerCase().includes(searchTerm) ||
      user.username?.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full min-h-[40px] max-h-[120px] px-4 py-2 bg-background border rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        rows={1}
      />

      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto z-50">
          <Command>
            <CommandList>
              {filteredUsers.length === 0 ? (
                <CommandEmpty>No users found</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredUsers.map((user, index) => (
                    <CommandItem
                      key={user.id}
                      onSelect={() => insertMention(user)}
                      className={`cursor-pointer ${index === selectedIndex ? 'bg-accent' : ''}`}
                    >
                      <Avatar className="w-8 h-8 mr-2">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback>{user.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.display_name || 'Unknown'}</p>
                        {user.username && (
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};
