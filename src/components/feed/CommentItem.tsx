import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Trash2, Send, AtSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ReactionPicker } from './ReactionPicker';
import { UserMentionPicker } from './UserMentionPicker';
import { CommentText } from './CommentText';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface CommentItemProps {
  comment: Comment;
  allComments: Comment[];
  postOwnerId: string;
  onUpdate: () => void;
  onReplyToggle?: (isActive: boolean) => void;
  level?: number;
}

export const CommentItem = ({
  comment,
  allComments,
  postOwnerId,
  onUpdate,
  onReplyToggle,
  level = 0,
}: CommentItemProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(comment.likes_count);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(level < 2); // Auto-expand first 2 levels
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayName =
    comment.profiles?.display_name || comment.profiles?.username || 'Anonymous';
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const isOwnComment = user?.id === comment.user_id;
  const replies = allComments.filter((c) => c.parent_comment_id === comment.id);

  const handleLike = async () => {
    if (!user) return;

    const newIsLiked = !isLiked;
    const newLikesCount = newIsLiked ? localLikesCount + 1 : localLikesCount - 1;

    setIsLiked(newIsLiked);
    setLocalLikesCount(newLikesCount);

    try {
      if (newIsLiked) {
        await supabase.from('comment_likes').insert({
          comment_id: comment.id,
          user_id: user.id,
        });
      } else {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', user.id);
      }
    } catch (error: any) {
      setIsLiked(!newIsLiked);
      setLocalLikesCount(localLikesCount);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleTextChange = (value: string) => {
    setReplyText(value);
    
    // Check for @ mention
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes(' ');
      
      if (!hasSpace && textAfterAt.length > 0) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (username: string) => {
    const lastAtIndex = replyText.lastIndexOf('@');
    const newText = replyText.substring(0, lastAtIndex) + '@' + username + ' ';
    setReplyText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleReply = async () => {
    if (!user || !replyText.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: comment.post_id,
        user_id: user.id,
        parent_comment_id: comment.id,
        content: replyText.trim(),
      });

      if (error) throw error;

      setReplyText('');
      setShowReply(false);
      setShowMentions(false);
      onReplyToggle?.(false);
      setShowReplies(true);
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', comment.id);

      if (error) throw error;

      toast({
        title: 'Comment deleted',
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={`${level > 0 ? 'ml-8 mt-3' : ''}`}>
      <div className="flex space-x-3">
        <Avatar 
          className="w-8 h-8 flex-shrink-0 cursor-pointer hover:opacity-80"
          onClick={() => window.location.href = `/profile/${comment.user_id}`}
        >
          <AvatarImage src={comment.profiles?.avatar_url || ''} />
          <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-xs">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="bg-gray-800 rounded-2xl px-4 py-2">
            <div className="flex items-center justify-between mb-1">
              <span 
                className="font-semibold text-sm cursor-pointer hover:underline"
                onClick={() => window.location.href = `/profile/${comment.user_id}`}
              >
                {displayName}
              </span>
              {comment.user_id === postOwnerId && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                  Author
                </span>
              )}
            </div>
            <CommentText content={comment.content} className="text-sm text-white whitespace-pre-wrap" />
          </div>

          <div className="flex items-center space-x-4 mt-1 ml-2">
            <Button
              onClick={handleLike}
              variant="ghost"
              size="sm"
              className={`h-auto p-0 text-xs ${
                isLiked ? 'text-pink-500' : 'text-gray-400'
              } hover:text-pink-500`}
            >
              <Heart className={`w-3 h-3 mr-1 ${isLiked ? 'fill-current' : ''}`} />
              {localLikesCount > 0 && localLikesCount}
            </Button>

            <Button
              onClick={() => {
                setShowReply(!showReply);
                onReplyToggle?.(!showReply);
              }}
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-gray-400 hover:text-blue-500"
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Reply
            </Button>

            <span className="text-xs text-gray-500">{timeAgo}</span>

            {isOwnComment && (
              <Button
                onClick={handleDelete}
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Reply Input */}
          {showReply && (
            <div className="mt-2 space-y-2">
              <div className="flex items-end space-x-2 relative">
                {showMentions && (
                  <div className="absolute bottom-full mb-2 left-0 right-12 z-10">
                    <UserMentionPicker
                      searchTerm={mentionSearch}
                      onSelect={handleMentionSelect}
                      show={showMentions}
                    />
                  </div>
                )}
                <Textarea
                  ref={textareaRef}
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white text-sm resize-none"
                  rows={2}
                  disabled={submitting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <div className="flex flex-col space-y-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMentions(!showMentions)}
                    className="text-gray-400 hover:text-white h-8 w-8"
                  >
                    <AtSign className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleReply}
                    disabled={submitting || !replyText.trim()}
                    size="icon"
                    className="bg-gradient-to-r from-pink-500 to-blue-500 h-8 w-8"
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Nested Replies */}
          {replies.length > 0 && (
            <div className="mt-2">
              {!showReplies && (
                <Button
                  onClick={() => setShowReplies(true)}
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-blue-400 hover:text-blue-300"
                >
                  View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </Button>
              )}

              {showReplies && (
                <>
                  {replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                  comment={reply}
                  allComments={allComments}
                  postOwnerId={postOwnerId}
                  onUpdate={onUpdate}
                  onReplyToggle={onReplyToggle}
                  level={level + 1}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};