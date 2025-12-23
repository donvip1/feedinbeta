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

interface Viewer {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
}

interface LiveStreamMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  placeholder?: string;
  streamId: string;
  className?: string;
}

export const LiveStreamMentionInput = ({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  disabled,
  placeholder = "Send a message...",
  streamId,
  className,
}: LiveStreamMentionInputProps) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [filteredViewers, setFilteredViewers] = useState<Viewer[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionStartRef = useRef<number>(-1);

  // Fetch stream viewers
  useEffect(() => {
    const fetchViewers = async () => {
      const { data: viewerData } = await supabase
        .from('live_stream_viewers')
        .select('id, user_id')
        .eq('stream_id', streamId)
        .eq('is_active', true);

      if (!viewerData || viewerData.length === 0) return;

      const userIds = viewerData.map(v => v.user_id).filter(Boolean);
      if (userIds.length === 0) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      if (profiles) {
        const viewerList = viewerData
          .filter(v => v.user_id)
          .map(v => {
            const profile = profiles.find(p => p.id === v.user_id);
            return {
              id: v.id,
              user_id: v.user_id!,
              display_name: profile?.display_name || 'User',
              username: profile?.username || 'user',
              avatar_url: profile?.avatar_url || '',
            };
          });
        setViewers(viewerList);
      }
    };

    if (streamId) {
      fetchViewers();
      // Refetch periodically
      const interval = setInterval(fetchViewers, 15000);
      return () => clearInterval(interval);
    }
  }, [streamId]);

  // Filter viewers based on query
  useEffect(() => {
    if (mentionQuery) {
      const filtered = viewers.filter(v =>
        v.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        v.username.toLowerCase().includes(mentionQuery.toLowerCase())
      );
      setFilteredViewers(filtered);
      setSelectedIndex(0);
    } else {
      setFilteredViewers(viewers);
    }
  }, [mentionQuery, viewers]);

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

  const insertMention = (viewer: Viewer) => {
    if (mentionStartRef.current === -1) return;

    const before = value.slice(0, mentionStartRef.current);
    const after = value.slice(cursorPosition);
    const mention = `@${viewer.username} `;
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
    if (showMentions && filteredViewers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredViewers.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredViewers[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !showMentions) {
      e.preventDefault();
      onSubmit?.();
      return;
    }

    onKeyDown?.(e);
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="pr-2 h-9"
        autoComplete="off"
      />

      {/* Mentions dropdown */}
      {showMentions && filteredViewers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
          <Command className="rounded-lg border shadow-lg bg-popover max-h-40">
            <CommandList>
              <CommandGroup heading="Mention viewer">
                {filteredViewers.slice(0, 5).map((viewer, index) => (
                  <CommandItem
                    key={viewer.id}
                    onSelect={() => insertMention(viewer)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      index === selectedIndex && "bg-accent"
                    )}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={viewer.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {viewer.display_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {viewer.display_name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        @{viewer.username}
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
