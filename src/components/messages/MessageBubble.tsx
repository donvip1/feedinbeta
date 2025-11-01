import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  isOwn: boolean;
}

export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="w-8 h-8">
        <AvatarImage src={message.profiles.avatar_url || ''} />
        <AvatarFallback>{message.profiles.display_name?.[0] || 'U'}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white'
              : 'bg-accent'
          }`}
        >
          <p className="text-sm break-words">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          {format(new Date(message.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
};
