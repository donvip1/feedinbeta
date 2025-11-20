import { useState, useEffect } from 'react';
import { X, Send, Heart, MessageCircle, MoreVertical } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export default function CommentsModal({ isOpen, onClose, postId }: CommentsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, postId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          ),
          comment_likes (count)
        `)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim() || !user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: comment.trim(),
        parent_comment_id: replyTo,
      });

      if (error) throw error;

      toast({ title: 'Comment posted!' });
      setComment('');
      setReplyTo(null);
      fetchComments();
    } catch (error) {
      toast({
        title: 'Error posting comment',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { data: existingLike } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingLike) {
        await supabase.from('comment_likes').delete().eq('id', existingLike.id);
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: user.id,
        });
      }
      fetchComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg h-[85vh] p-0 flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">Comments</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments list */}
        <ScrollArea className="flex-1 px-4">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">No comments yet</p>
              <p className="text-xs">Be the first to comment</p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group animate-in fade-in slide-in-from-bottom-2">
                  <Avatar className="w-9 h-9 ring-2 ring-background">
                    <AvatarImage src={c.profiles?.avatar_url} />
                    <AvatarFallback className="text-xs">{c.profiles?.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted rounded-2xl px-3 py-2">
                      <p className="text-sm font-semibold">{c.profiles?.display_name}</p>
                      <p className="text-sm leading-relaxed break-words">{c.content}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 px-3">
                      <button
                        onClick={() => handleLikeComment(c.id)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Heart className="w-3 h-3" />
                        <span>{c.comment_likes?.[0]?.count || 0}</span>
                      </button>
                      <button
                        onClick={() => setReplyTo(c.id)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Reply
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Add comment */}
        <div className="border-t px-4 py-3 bg-background">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <span>Replying to comment</span>
              <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="h-6 px-2">
                Cancel
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">{user?.user_metadata?.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="resize-none pr-12 min-h-[40px] max-h-[120px] rounded-full border-2 focus:border-primary transition-colors"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !comment.trim()}
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
