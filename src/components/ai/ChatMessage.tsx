import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EnhancedMarkdownRenderer } from './EnhancedMarkdownRenderer';
import { ResponseActions } from './ResponseActions';
import { TypingIndicator } from './TypingIndicator';
import { cn } from '@/lib/utils';
import feedinIcon from '@/assets/feedin-icon.png';

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
  userAvatar?: string;
  userName?: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (positive: boolean) => void;
  showActions?: boolean;
  isLatest?: boolean;
}

export const ChatMessage = ({
  message,
  userAvatar,
  userName = 'You',
  onCopy,
  onRegenerate,
  onFeedback,
  showActions = true,
  isLatest = false,
}: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex gap-3 group',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <Avatar className="w-9 h-9 ring-2 ring-primary/20">
            <AvatarImage src={userAvatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="relative">
            <Avatar className="w-9 h-9 ring-2 ring-primary/30 shadow-lg shadow-primary/20">
              <AvatarImage src={feedinIcon} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                AI
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-sm" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        'flex-1 max-w-[85%] space-y-2',
        isUser ? 'items-end' : 'items-start'
      )}>
        {/* Name label */}
        <div className={cn(
          'text-xs font-medium text-muted-foreground mb-1',
          isUser ? 'text-right' : 'text-left'
        )}>
          {isUser ? userName : 'FeedIn AI'}
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md'
              : 'bg-card border border-border/50 rounded-tl-md shadow-md'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <TypingIndicator />
          ) : (
            <EnhancedMarkdownRenderer 
              content={message.content} 
              className="text-sm"
              animate={isLatest}
            />
          )}
        </div>

        {/* Response Actions - Only for AI messages */}
        {!isUser && showActions && message.content && !isStreaming && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ResponseActions
              content={message.content}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
              onFeedback={onFeedback}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;
