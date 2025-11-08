import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    is_read?: boolean;
    read_at?: string;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  isOwn: boolean;
}

export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  const navigate = useNavigate();
  
  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar 
        className="w-8 h-8 cursor-pointer hover:opacity-80"
        onClick={() => navigate(`/profile/${message.sender_id}`)}
      >
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
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {isOwn && (
            message.is_read ? (
              <CheckCheck className="w-3 h-3 text-blue-500" />
            ) : (
              <Check className="w-3 h-3" />
            )
          )}
        </div>
      </div>
    </div>
  );
};
