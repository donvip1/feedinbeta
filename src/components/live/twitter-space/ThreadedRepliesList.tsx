import React from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { MentionText } from '../MentionText';

interface Reply {
  id: string;
  user_id: string;
  user: string;
  handle: string;
  time: string;
  text: string;
  avatar: string;
  likes: number;
  liked_by_me: boolean;
  isGift?: boolean;
  reply_to_id?: string | null;
}

interface ThreadedRepliesListProps {
  replies: Reply[];
  onReplyToMessage: (reply: Reply) => void;
  onLikeMessage: (messageId: string) => void;
  onNavigateToProfile: (userId: string) => void;
}

const ReplyItem = ({
  reply,
  childReplies,
  onReplyToMessage,
  onLikeMessage,
  onNavigateToProfile,
  isChild = false,
}: {
  reply: Reply;
  childReplies: Reply[];
  onReplyToMessage: (reply: Reply) => void;
  onLikeMessage: (messageId: string) => void;
  onNavigateToProfile: (userId: string) => void;
  isChild?: boolean;
}) => (
  <div className={isChild ? '' : 'pb-4 border-b border-zinc-800'}>
    <div className="flex gap-3">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigateToProfile(reply.user_id);
        }}
        className="flex-shrink-0"
      >
        <img
          src={reply.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.user}`}
          alt={reply.user}
          className={`${isChild ? 'w-7 h-7' : 'w-10 h-10'} rounded-full hover:ring-2 hover:ring-purple-500 transition-all`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToProfile(reply.user_id);
            }}
            className="text-white font-semibold hover:underline text-sm"
          >
            {reply.user}
          </button>
          <span className="text-zinc-500 text-xs">{reply.handle}</span>
          <span className="text-zinc-500 text-xs">· {reply.time}</span>
        </div>
        {reply.isGift ? (
          <div className="mt-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-lg px-3 py-2 inline-block">
            <span className="text-pink-400 font-medium">{reply.text}</span>
          </div>
        ) : (
          <MentionText text={reply.text} className="text-zinc-300 text-sm mt-1 break-words" />
        )}
        <div className="flex gap-6 mt-2 text-zinc-500 text-xs">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReplyToMessage(reply);
            }}
            className="flex items-center gap-1 hover:text-purple-400 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLikeMessage(reply.id);
            }}
            className={`flex items-center gap-1 transition-colors ${
              reply.liked_by_me ? 'text-red-500' : 'hover:text-red-400'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${reply.liked_by_me ? 'fill-current' : ''}`} />
            <span>{reply.likes > 0 ? reply.likes : 'Like'}</span>
          </button>
        </div>

        {/* Child replies (threaded) */}
        {childReplies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-zinc-800 pl-3">
            {childReplies.map(child => (
              <ReplyItem
                key={child.id}
                reply={child}
                childReplies={[]} // Only one level of nesting
                onReplyToMessage={onReplyToMessage}
                onLikeMessage={onLikeMessage}
                onNavigateToProfile={onNavigateToProfile}
                isChild
              />
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const ThreadedRepliesList = ({
  replies,
  onReplyToMessage,
  onLikeMessage,
  onNavigateToProfile,
}: ThreadedRepliesListProps) => {
  // Separate top-level messages from threaded replies
  const topLevel = replies.filter(r => !r.reply_to_id);
  const childMap = new Map<string, Reply[]>();

  replies.forEach(r => {
    if (r.reply_to_id) {
      const existing = childMap.get(r.reply_to_id) || [];
      existing.push(r);
      childMap.set(r.reply_to_id, existing);
    }
  });

  // Also include replies whose parent isn't in our list as top-level
  const orphanReplies = replies.filter(r => r.reply_to_id && !replies.some(p => p.id === r.reply_to_id));
  const allTopLevel = [...topLevel, ...orphanReplies];

  return (
    <div className="space-y-4">
      {allTopLevel.map(reply => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          childReplies={childMap.get(reply.id) || []}
          onReplyToMessage={onReplyToMessage}
          onLikeMessage={onLikeMessage}
          onNavigateToProfile={onNavigateToProfile}
        />
      ))}
    </div>
  );
};
