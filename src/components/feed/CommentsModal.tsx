import { useState, useEffect, useRef } from 'react';
import { Send, Heart, MoreVertical, X as XIcon } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postData?: {
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    profiles?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

export default function CommentsModal({ isOpen, onClose, postId, postData }: CommentsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartPos = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      fetchUsers();
      
      // Subscribe to realtime comments
      const channel = supabase
        .channel(`comments:${postId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'post_comments',
            filter: `post_id=eq.${postId}`,
          },
          () => {
            fetchComments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, postId]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .limit(50);
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setComment(newValue);

    // Check for @ mention
    const textBeforeCursor = newValue.slice(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        mentionStartPos.current = lastAtIndex;
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (selectedUser: any) => {
    const beforeMention = comment.slice(0, mentionStartPos.current);
    const afterMention = comment.slice(textareaRef.current?.selectionStart || 0);
    const mentionText = `@${selectedUser.username || selectedUser.display_name} `;
    
    const newValue = beforeMention + mentionText + afterMention;
    setComment(newValue);
    setShowMentions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const filteredUsers = users.filter(u => 
    (u.username?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
     u.display_name?.toLowerCase().includes(mentionQuery.toLowerCase()))
  );

  const handleSubmit = async () => {
    if (!comment.trim() || !user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: comment.trim(),
        parent_comment_id: replyTo?.id || null,
      });

      if (error) throw error;

      toast({ title: 'Comment posted!' });
      setComment('');
      setReplyTo(null);
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col">
        {/* Post Preview Overlay */}
        {postData && (
          <div className="flex-shrink-0 bg-muted/50 p-4 border-b">
            <div className="flex gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={postData.profiles?.avatar_url || ''} />
                <AvatarFallback>{postData.profiles?.display_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{postData.profiles?.display_name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{postData.content}</p>
              </div>
              {postData.media_url && (
                <img 
                  src={postData.media_url} 
                  alt="Post preview" 
                  className="w-16 h-16 object-cover rounded"
                />
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Comments</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments list */}
        <ScrollArea className="flex-1 px-4">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
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
                        onClick={() => setReplyTo({ id: c.id, username: c.profiles?.display_name || 'User' })}
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
        <div className="border-t px-4 py-3 bg-background flex-shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between mb-2 p-2 bg-muted rounded-lg">
              <span className="text-xs text-muted-foreground">Replying to {replyTo.username}</span>
              <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="h-6 px-2">
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">{user?.user_metadata?.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              {showMentions && filteredUsers.length > 0 && (
                <div className="absolute bottom-full mb-2 w-full bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                  {filteredUsers.slice(0, 5).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => insertMention(u)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-muted transition-colors"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="text-xs">{u.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="text-sm font-medium">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={comment}
                onChange={handleInputChange}
                placeholder="Add a comment..."
                className="w-full resize-none pr-12 min-h-[40px] max-h-[120px] rounded-2xl border-2 border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none transition-colors"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !comment.trim()}
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
