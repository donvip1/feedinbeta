import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import PostCard from '@/components/feed/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/navigation/BottomNav';
import { sanitizeSearchQuery } from '@/lib/search-utils';

const Search = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim()) {
      handleSearch();
    }
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      let postsData: any[] = [];

      // Sanitize search input
      const safeQuery = sanitizeSearchQuery(query);
      
      // Check if searching for a hashtag
      if (query.trim().startsWith('#')) {
        const hashtagName = sanitizeSearchQuery(query.trim().slice(1).toLowerCase());
        
        // Find hashtag
        const { data: hashtagData } = await supabase
          .from('hashtags')
          .select('id')
          .ilike('name', hashtagName)
          .maybeSingle();

        if (hashtagData) {
          // Get posts with this hashtag
          const { data: postHashtags } = await supabase
            .from('post_hashtags')
            .select('post_id')
            .eq('hashtag_id', hashtagData.id);

          if (postHashtags && postHashtags.length > 0) {
            const postIds = postHashtags.map(ph => ph.post_id);
            
            const { data: posts } = await supabase
              .from('posts')
              .select(`
                *,
                profiles:user_id (
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .in('id', postIds)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(20);

            postsData = posts || [];
          }
        }
      } else {
        // Search posts by content with sanitized query
        const { data: posts } = await supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              username,
              display_name,
              avatar_url
            )
          `)
          .ilike('content', `%${safeQuery}%`)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(20);

        postsData = posts || [];
      }

      // Search users with sanitized query
      const safeUserQuery = sanitizeSearchQuery(query.replace('#', ''));
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${safeUserQuery}%,display_name.ilike.%${safeUserQuery}%`)
        .limit(20);

      // Search hashtags with sanitized query
      const { data: hashtagsData } = await supabase
        .from('hashtags')
        .select('*')
        .ilike('name', `%${safeUserQuery}%`)
        .order('posts_count', { ascending: false })
        .limit(20);

      setPosts(postsData);
      setUsers(usersData || []);
      setHashtags(hashtagsData || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search posts, users, hashtags..."
                className="pr-10"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSearch}
                className="absolute right-0 top-0"
              >
                <SearchIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="posts" className="flex-1">Posts ({posts.length})</TabsTrigger>
              <TabsTrigger value="users" className="flex-1">Users ({users.length})</TabsTrigger>
              <TabsTrigger value="hashtags" className="flex-1">Tags ({hashtags.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="space-y-4 mt-4">
              {loading ? (
                <p className="text-center text-muted-foreground">Searching...</p>
              ) : posts.length === 0 ? (
                <p className="text-center text-muted-foreground">No posts found</p>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-3 mt-4">
              {loading ? (
                <p className="text-center text-muted-foreground">Searching...</p>
              ) : users.length === 0 ? (
                <p className="text-center text-muted-foreground">No users found</p>
              ) : (
                users.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => navigate(`/profile/${profile.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <Avatar>
                      <AvatarImage src={profile.avatar_url || ''} />
                      <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{profile.display_name}</p>
                      <p className="text-sm text-muted-foreground">@{profile.username}</p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="hashtags" className="space-y-2 mt-4">
              {loading ? (
                <p className="text-center text-muted-foreground">Searching...</p>
              ) : hashtags.length === 0 ? (
                <p className="text-center text-muted-foreground">No hashtags found</p>
              ) : (
                hashtags.map((tag) => (
                  <div
                    key={tag.id}
                    onClick={() => {
                      setQuery(`#${tag.name}`);
                      // Trigger search immediately
                      setTimeout(() => handleSearch(), 0);
                    }}
                    className="p-3 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <p className="font-semibold">#{tag.name}</p>
                    <p className="text-sm text-muted-foreground">{tag.posts_count || 0} posts</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Search;
