import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Image as ImageIcon, Check, Loader2 } from 'lucide-react';

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
  content: string | null;
  created_at: string;
}

interface PostSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (post: Post) => void;
}

export const PostSelectorModal = ({
  open,
  onOpenChange,
  onSelect,
}: PostSelectorModalProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [filter, setFilter] = useState<'all' | 'video' | 'image'>('all');

  useEffect(() => {
    if (open && user) {
      loadPosts();
    }
  }, [open, user]);

  const loadPosts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, content, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (filter === 'all') return true;
    return post.media_type === filter;
  });

  const handleConfirm = () => {
    if (selectedPost) {
      onSelect(selectedPost);
      onOpenChange(false);
      setSelectedPost(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Post to Promote</DialogTitle>
        </DialogHeader>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Posts</TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1">
              <Play className="w-3 h-3" /> Videos
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Photos
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4 overflow-y-auto max-h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No {filter !== 'all' ? filter : ''} posts found</p>
                <p className="text-sm">Create some content first to promote!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedPost?.id === post.id
                        ? 'ring-4 ring-primary ring-offset-2 ring-offset-background scale-95'
                        : 'hover:opacity-80'
                    }`}
                  >
                    {post.media_type === 'video' ? (
                      <>
                        <video
                          src={post.media_url || ''}
                          className="w-full h-full object-cover"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-8 h-8 text-white" fill="white" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={post.media_url || ''}
                        alt="Post"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {selectedPost?.id === post.id && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-6 h-6 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPost}
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
          >
            Select Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
