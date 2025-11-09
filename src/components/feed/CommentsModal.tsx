import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Image as ImageIcon, AtSign } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { EmojiPicker } from './EmojiPicker';
import { UserMentionPicker } from './UserMentionPicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

interface CommentsModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  postOwnerId: string;
}

export const CommentsModal = ({ open, onClose, postId, postOwnerId }: CommentsModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, postId]);

  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          console.log('New comment received:', payload);
          // Fetch the full comment with profile data
          const { data, error } = await supabase
            .from('post_comments')
            .select(`
              *,
              profiles (
                display_name,
                username,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            setComments((prev) => [...prev, data]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('Comment updated:', payload);
          setComments((prev) =>
            prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('Comment deleted:', payload);
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, postId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading comments',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  const handleTextChange = (value: string) => {
    setNewComment(value);
    
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
    const lastAtIndex = newComment.lastIndexOf('@');
    const newText = newComment.substring(0, lastAtIndex) + '@' + username + ' ';
    setNewComment(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    const newText = newComment + emoji;
    setNewComment(newText);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: newComment.trim(),
      });

      if (error) throw error;

      setNewComment('');
      // Don't show toast - comment will appear via real-time subscription
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Unable to add comment',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const topLevelComments = comments.filter((c) => !c.parent_comment_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[85vh] flex flex-col my-8">
        <DialogHeader>
          <DialogTitle>Comments ({comments.length})</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Tap the 😊 button on any comment to add emoji reactions
          </p>
        </DialogHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : topLevelComments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            topLevelComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                allComments={comments}
                postOwnerId={postOwnerId}
                onUpdate={loadComments}
              />
            ))
          )}
        </div>

        {/* Enhanced Comment Input */}
        <div className="pt-4 border-t border-gray-800 space-y-2">
          <div className="flex items-start space-x-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.user_metadata?.avatar_url || ''} />
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-xs">
                {user?.user_metadata?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <UserMentionPicker
                searchTerm={mentionSearch}
                onSelect={handleMentionSelect}
                show={showMentions}
              />
              <Textarea
                ref={textareaRef}
                placeholder="Add comment..."
                value={newComment}
                onChange={(e) => handleTextChange(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white resize-none min-h-[60px]"
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between pl-10">
            <div className="flex items-center space-x-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <AtSign className="w-5 h-5" />
              </Button>
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <ImageIcon className="w-5 h-5" />
              </Button>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              className="bg-pink-500 hover:bg-pink-600 text-white rounded-full px-6"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};