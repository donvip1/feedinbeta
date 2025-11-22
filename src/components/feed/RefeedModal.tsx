import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Repeat, Quote, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface RefeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  post?: any;
}

export default function RefeedModal({ isOpen, onClose, postId, post }: RefeedModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showQuoteComposer, setShowQuoteComposer] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handleRefeed = async () => {
    if (!user) return;

    try {
      // Check if already refeeded
      const { data: existing } = await supabase
        .from('post_shares')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('share_type', 'refeed')
        .maybeSingle();

      if (existing) {
        toast({ 
          title: 'Already refeeded',
          description: 'You have already shared this post'
        });
        onClose();
        return;
      }

      await supabase.from('post_shares').insert([{
        post_id: postId,
        user_id: user.id,
        share_type: 'refeed',
      }]);

      // Increment refeed count
      const { data: currentPost } = await supabase
        .from('posts')
        .select('refeeds_count')
        .eq('id', postId)
        .single();

      if (currentPost) {
        await supabase
          .from('posts')
          .update({ refeeds_count: (currentPost.refeeds_count || 0) + 1 })
          .eq('id', postId);
      }

      toast({ 
        title: 'Refeeded successfully!',
        description: 'Post shared to your feed'
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Error refeeding post',
        variant: 'destructive',
      });
    }
  };

  const handleQuoteRefeed = async () => {
    if (!user || !quoteText.trim()) return;

    setIsPosting(true);
    try {
      // Create new post with quote
      const { data: newPost, error } = await supabase.from('posts').insert([{
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: quoteText.trim(),
        original_post_id: postId,
        post_type: 'quote',
        status: 'active',
      }]).select().single();

      if (error) throw error;

      // Insert share record
      await supabase.from('post_shares').insert([{
        post_id: postId,
        user_id: user.id,
        share_type: 'quote',
      }]);

      // Increment refeed count
      const { data: currentPost } = await supabase
        .from('posts')
        .select('refeeds_count')
        .eq('id', postId)
        .single();

      if (currentPost) {
        await supabase
          .from('posts')
          .update({ refeeds_count: (currentPost.refeeds_count || 0) + 1 })
          .eq('id', postId);
      }

      toast({ 
        title: 'Quote posted!',
        description: 'Your quote has been shared'
      });
      onClose();
      setShowQuoteComposer(false);
      setQuoteText('');
    } catch (error: any) {
      console.error('Error posting quote:', error);
      toast({
        title: 'Error posting quote',
        description: error.message || 'Failed to post quote',
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
    }
  };

  if (showQuoteComposer) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Button variant="ghost" size="icon" onClick={() => setShowQuoteComposer(false)}>
                <X className="w-5 h-5" />
              </Button>
              <h2 className="text-lg font-semibold">Quote Post</h2>
              <Button 
                onClick={handleQuoteRefeed} 
                disabled={isPosting || !quoteText.trim()}
                className="rounded-full"
              >
                Post
              </Button>
            </div>

            {/* Composer */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex gap-3 mb-4">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>{user?.user_metadata?.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <Textarea
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Add your thoughts..."
                  className="min-h-[120px] border-0 focus-visible:ring-0 resize-none text-base"
                  autoFocus
                />
              </div>

              {/* Quoted Post Preview */}
              {post && (
                <div className="border rounded-2xl p-3 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={post.profiles?.avatar_url} />
                      <AvatarFallback className="text-xs">{post.profiles?.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold">{post.profiles?.display_name}</span>
                    <span className="text-xs text-muted-foreground">@{post.profiles?.username}</span>
                  </div>
                  <p className="text-sm line-clamp-3">{post.content}</p>
                  {post.media_url && (
                    <img 
                      src={post.media_url} 
                      alt="Post" 
                      className="mt-2 rounded-lg w-full max-h-48 object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl p-0 pb-6">
        <div className="space-y-1 p-4">
          <Button
            onClick={handleRefeed}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Repeat className="w-5 h-5" />
            <span className="font-medium">Refeed</span>
          </Button>

          <Button
            onClick={() => setShowQuoteComposer(true)}
            className="w-full flex items-center justify-start gap-3 h-12 rounded-lg bg-card hover:bg-accent"
            variant="ghost"
          >
            <Quote className="w-5 h-5" />
            <span className="font-medium">Quote Feed</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
