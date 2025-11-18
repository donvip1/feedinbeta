import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostCard } from '@/components/feed/PostCard';
import { BottomNav } from '@/components/navigation/BottomNav';
import { TrendingUp, Hash, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Trending = () => {
  const navigate = useNavigate();
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

  const { data: trendingPosts, refetch: refetchPosts } = useQuery({
    queryKey: ['trending-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trending_posts')
        .select(`
          *,
          posts!inner (
            *,
            profiles!inner (
              display_name,
              username,
              avatar_url
            )
          )
        `)
        .order('trending_rank', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const { data: trendingHashtags } = useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hashtags')
        .select('*')
        .order('posts_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const { data: hashtagPosts, refetch: refetchHashtagPosts } = useQuery({
    queryKey: ['hashtag-posts', selectedHashtag],
    queryFn: async () => {
      if (!selectedHashtag) return [];

      const { data: hashtagData } = await supabase
        .from('hashtags')
        .select('id')
        .eq('name', selectedHashtag)
        .single();

      if (!hashtagData) return [];

      const { data, error } = await supabase
        .from('post_hashtags')
        .select(`
          post_id,
          posts!inner (
            *,
            profiles!inner (
              display_name,
              username,
              avatar_url
            )
          )
        `)
        .eq('hashtag_id', hashtagData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedHashtag,
  });

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => navigate('/feed')}
                  variant="ghost"
                  size="icon"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Trending
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <Tabs defaultValue="posts">
            <TabsList className="w-full">
              <TabsTrigger value="posts" className="flex-1">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trending Posts
              </TabsTrigger>
              <TabsTrigger value="hashtags" className="flex-1">
                <Hash className="w-4 h-4 mr-2" />
                Hashtags
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              {selectedHashtag && (
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    #{selectedHashtag}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedHashtag(null)}
                  >
                    Clear filter
                  </Button>
                </div>
              )}

              <div className="space-y-6">
                {!selectedHashtag && trendingPosts && trendingPosts.length > 0 ? (
                  trendingPosts.map((trending: any, index) => (
                    <div key={trending.post_id} className="relative">
                      <div className="absolute -left-2 top-4 z-10">
                        <Badge className="bg-primary text-primary-foreground">
                          #{index + 1}
                        </Badge>
                      </div>
                      <PostCard
                        post={trending.posts}
                        onUpdate={refetchPosts}
                      />
                    </div>
                  ))
                ) : selectedHashtag && hashtagPosts && hashtagPosts.length > 0 ? (
                  hashtagPosts.map((item: any) => (
                    <PostCard
                      key={item.post_id}
                      post={item.posts}
                      onUpdate={refetchHashtagPosts}
                    />
                  ))
                ) : (
                  <div className="text-center py-20">
                    <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No trending posts yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="hashtags" className="mt-6">
              <div className="grid grid-cols-1 gap-3">
                {trendingHashtags && trendingHashtags.length > 0 ? (
                  trendingHashtags.map((hashtag: any, index) => (
                    <div
                      key={hashtag.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedHashtag(hashtag.name);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary text-primary-foreground">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-semibold text-lg">#{hashtag.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {hashtag.posts_count} posts
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHashtag(hashtag.name);
                        }}
                      >
                        View Posts
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <Hash className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No trending hashtags yet</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <BottomNav />
      </div>
    </>
  );
};

export default Trending;
