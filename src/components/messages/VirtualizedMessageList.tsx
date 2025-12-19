import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  [key: string]: any;
}

interface VirtualizedMessageListProps {
  messages: Message[];
  currentUserId: string;
  renderMessage: (message: Message, showDateHeader: boolean) => React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  className?: string;
  overscan?: number; // Number of items to render outside viewport
}

// Memoized message wrapper to prevent unnecessary re-renders
const MessageWrapper = memo<{ 
  message: Message; 
  showDateHeader: boolean;
  renderMessage: (message: Message, showDateHeader: boolean) => React.ReactNode;
}>(({ message, showDateHeader, renderMessage }) => (
  <div data-message-id={message.id}>
    {renderMessage(message, showDateHeader)}
  </div>
));

MessageWrapper.displayName = 'MessageWrapper';

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  currentUserId,
  renderMessage,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  className,
  overscan = 5,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessagesLength = useRef(messages.length);
  const shouldScrollToBottom = useRef(true);

  // Format date header
  const formatDateHeader = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // Check if we should show date header before this message
  const shouldShowDateHeader = (index: number): boolean => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].created_at);
    const prevDate = new Date(messages[index - 1].created_at);
    return !isSameDay(currentDate, prevDate);
  };

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = false) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Handle scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Check if at bottom (within 100px)
    const atBottom = distanceFromBottom < 100;
    setIsAtBottom(atBottom);
    shouldScrollToBottom.current = atBottom;

    // Load more when scrolled near top
    if (scrollTop < 100 && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Scroll to bottom on new messages (if user was at bottom)
  useEffect(() => {
    const newMessagesAdded = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (newMessagesAdded && shouldScrollToBottom.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages.length, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-full overflow-y-auto overflow-x-hidden',
        'scroll-smooth overscroll-contain',
        className
      )}
      onScroll={handleScroll}
      data-scrollable="true"
      style={{
        WebkitOverflowScrolling: 'touch',
        transform: 'translateZ(0)',
        willChange: 'scroll-position',
      }}
    >
      {/* Loading indicator for older messages */}
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {/* Message list */}
      <div className="flex flex-col">
        {messages.map((message, index) => (
          <MessageWrapper
            key={message.id}
            message={message}
            showDateHeader={shouldShowDateHeader(index)}
            renderMessage={renderMessage}
          />
        ))}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={() => scrollToBottom(true)}
          className={cn(
            'fixed bottom-24 right-4 z-50',
            'w-10 h-10 rounded-full',
            'bg-primary text-primary-foreground',
            'shadow-lg hover:shadow-xl',
            'flex items-center justify-center',
            'transition-all duration-200',
            'animate-scale-in'
          )}
          aria-label="Scroll to bottom"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default VirtualizedMessageList;
