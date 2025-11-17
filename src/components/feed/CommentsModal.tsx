import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Image as ImageIcon, AtSign } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { EmojiPicker } from './EmojiPicker';
import { UserMentionPicker } from './UserMentionPicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

interface CommentsModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  postOwnerId: string;
  post: {
    id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    created_at: string;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
}

export const CommentsModal = ({ open, onClose, postId, postOwnerId, post }: CommentsModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [isReplyActive, setIsReplyActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      loadComments();
      subscribeToComments();
    }
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

  const subscribeToComments = () => {
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
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      toast({
        title: 'Comment added',
      });
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

  const displayName = user?.user_metadata?.display_name || 'You';
  const postDisplayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const isTextOnly = !post.media_url && post.content;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Auto-play video when comments open
    if (open && post.media_type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [open, post.media_type]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] p-0 bg-background">
        {/* Post Content - Visible Above Comments */}
        <div className="h-[40vh] bg-black relative flex-shrink-0">
          {post.media_url && (
            <>
              {post.media_type === 'image' && (
                <img src={post.media_url} alt="Post" className="w-full h-full object-contain" />
              )}
              {post.media_type === 'video' && (
                <video 
                  ref={videoRef}
                  src={post.media_url} 
                  className="w-full h-full object-contain" 
                  loop 
                  playsInline 
                  muted
                  controls
                />
              )}
            </>
          )}
          {isTextOnly && post.content && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 p-8">
              <div className="w-full max-w-lg">
                <p className="text-white font-semibold text-center leading-relaxed" 
                   style={{
                     fontSize: post.content.length < 50 ? '2rem' : 
                              post.content.length < 150 ? '1.75rem' :
                              post.content.length < 300 ? '1.5rem' : '1.25rem',
                     lineHeight: post.content.length < 50 ? '2.5rem' : 
                                post.content.length < 150 ? '2.25rem' :
                                post.content.length < 300 ? '2rem' : '1.75rem',
                   }}>
                  {post.content}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="flex flex-col h-[45vh]">
          <SheetHeader className="px-6 py-4 border-b border-border flex-shrink-0">
            <SheetTitle className="text-foreground">Comments ({comments.length})</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : comments.filter((c) => !c.parent_comment_id).length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No comments yet. Be the first!</p>
            ) : (
              comments.filter((c) => !c.parent_comment_id).map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  postOwnerId={postOwnerId}
                  onUpdate={loadComments}
                  onReplyToggle={setIsReplyActive}
                />
              ))
            )}
          </div>

          {/* Enhanced Comment Input */}
          {!isReplyActive && (
          <div className="px-6 py-4 border-t border-border bg-card flex-shrink-0">
            <div className="flex items-start space-x-3">
              <Avatar className="w-10 h-10 flex-shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="relative">
                  {showMentions && (
                    <div className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto border border-border rounded-lg bg-card shadow-lg z-10">
                      <UserMentionPicker
                        searchTerm={mentionSearch}
                        onSelect={handleMentionSelect}
                        show={showMentions}
                      />
                    </div>
                  )}
                  <Textarea
                    ref={textareaRef}
                    value={newComment}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Add a comment..."
                    className="min-h-[80px] resize-none bg-background text-foreground border-border"
                    disabled={submitting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMentions(!showMentions)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <AtSign className="w-4 h-4" />
                    </Button>
                    
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  </div>
                  
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !newComment.trim()}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};