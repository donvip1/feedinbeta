import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  role: string;
}

interface SpaceMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  spaceId: string;
}

export const SpaceMentionInput = ({
  value,
  onChange,
  onKeyDown,
  disabled,
  placeholder,
  spaceId,
}: SpaceMentionInputProps) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionStartRef = useRef<number>(-1);

  // Fetch space participants
  useEffect(() => {
    const fetchParticipants = async () => {
      const { data: speakers } = await supabase
        .from('live_space_speakers')
        .select('id, user_id, role')
        .eq('space_id', spaceId)
        .is('left_at', null);

      if (!speakers || speakers.length === 0) return;

      const userIds = speakers.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      if (profiles) {
        const participantList = speakers.map(s => {
          const profile = profiles.find(p => p.id === s.user_id);
          return {
            id: s.id,
            user_id: s.user_id,
            display_name: profile?.display_name || 'User',
            username: profile?.username || 'user',
            avatar_url: profile?.avatar_url || '',
            role: s.role || 'listener',
          };
        });
        setParticipants(participantList);
      }
    };

    if (spaceId) {
      fetchParticipants();
    }
  }, [spaceId]);

  // Filter participants based on query
  useEffect(() => {
    if (mentionQuery) {
      const filtered = participants.filter(p =>
        p.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        p.username.toLowerCase().includes(mentionQuery.toLowerCase())
      );
      setFilteredParticipants(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredParticipants(participants);
    }
  }, [mentionQuery, participants]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check for @ symbol to trigger mentions
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // Only show mentions if there's no space after @
      if (!textAfterAt.includes(' ')) {
        mentionStartRef.current = atIndex;
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        return;
      }
    }

    setShowMentions(false);
    mentionStartRef.current = -1;
  };

  const insertMention = (participant: Participant) => {
    if (mentionStartRef.current === -1) return;

    const before = value.slice(0, mentionStartRef.current);
    const after = value.slice(cursorPosition);
    const mention = `@${participant.username} `;
    const newValue = before + mention + after;

    onChange(newValue);
    setShowMentions(false);
    mentionStartRef.current = -1;
    setMentionQuery('');

    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = before.length + mention.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && filteredParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredParticipants.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredParticipants[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    onKeyDown?.(e);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'host':
        return <span className="text-[10px] text-amber-500 font-medium">Host</span>;
      case 'co_host':
        return <span className="text-[10px] text-amber-400 font-medium">Co-host</span>;
      case 'speaker':
        return <span className="text-[10px] text-primary font-medium">Speaker</span>;
      default:
        return null;
    }
  };

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="pr-2"
        autoComplete="off"
      />

      {/* Mentions dropdown */}
      {showMentions && filteredParticipants.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
          <Command className="rounded-lg border shadow-lg bg-popover max-h-48">
            <CommandList>
              <CommandGroup heading="Mention someone">
                {filteredParticipants.slice(0, 6).map((participant, index) => (
                  <CommandItem
                    key={participant.id}
                    onSelect={() => insertMention(participant)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      index === selectedIndex && "bg-accent"
                    )}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={participant.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {participant.display_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {participant.display_name}
                        </span>
                        {getRoleBadge(participant.role)}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        @{participant.username}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};
