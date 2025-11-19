import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Search as SearchIcon, ArrowLeft, User, Hash, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Search() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch();
    } else {
      setUsers([]);
      setHashtags([]);
      setPosts([]);
    }
  }, [searchQuery]);

  const performSearch = async () => {
    setSearching(true);
    try {
      // Search users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio')
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(20);

      // Search hashtags
      const { data: hashtagsData } = await supabase
        .from('hashtags')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .order('posts_count', { ascending: false })
        .limit(20);

      // Search posts
      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .ilike('content', `%${searchQuery}%`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      setUsers(usersData || []);
      setHashtags(hashtagsData || []);
      setPosts(postsData || []);
    } catch (error: any) {
      toast({
        title: 'Search error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users, hashtags, posts..."
              className="pl-10"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {searchQuery.length < 2 ? (
          <div className="text-center text-muted-foreground py-12">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Type at least 2 characters to search</p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6 mt-4">
              {/* Users Section */}
              {users.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Users
                  </h3>
                  <div className="space-y-2">
                    {users.slice(0, 3).map((user) => (
                      <Card
                        key={user.id}
                        className="p-3 cursor-pointer hover:bg-accent/50 transition"
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback>
                              {user.display_name?.[0] || user.username?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              {user.display_name || user.username || 'Anonymous'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              @{user.username || 'user'}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Hashtags Section */}
              {hashtags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Hashtags
                  </h3>
                  <div className="space-y-2">
                    {hashtags.slice(0, 3).map((tag) => (
                      <Card
                        key={tag.id}
                        className="p-3 cursor-pointer hover:bg-accent/50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">#{tag.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {tag.posts_count} posts
                            </p>
                          </div>
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts Section */}
              {posts.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Posts</h3>
                  <div className="space-y-2">
                    {posts.slice(0, 3).map((post: any) => (
                      <Card
                        key={post.id}
                        className="p-3 cursor-pointer hover:bg-accent/50 transition"
                        onClick={() => navigate(`/post/${post.id}`)}
                      >
                        <div className="flex gap-3">
                          {post.media_url && (
                            <img
                              src={post.media_url}
                              alt=""
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm mb-1">
                              {post.profiles?.display_name || post.profiles?.username}
                            </p>
                            {post.content && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {post.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {users.length === 0 && hashtags.length === 0 && posts.length === 0 && !searching && (
                <div className="text-center text-muted-foreground py-12">
                  <p>No results found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-2">
              {users.map((user) => (
                <Card
                  key={user.id}
                  className="p-3 cursor-pointer hover:bg-accent/50 transition"
                  onClick={() => navigate(`/profile/${user.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback>
                        {user.display_name?.[0] || user.username?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {user.display_name || user.username || 'Anonymous'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{user.username || 'user'}
                      </p>
                      {user.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="hashtags" className="mt-4 space-y-2">
              {hashtags.map((tag) => (
                <Card
                  key={tag.id}
                  className="p-3 cursor-pointer hover:bg-accent/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">#{tag.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tag.posts_count} posts
                      </p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="posts" className="mt-4 space-y-2">
              {posts.map((post: any) => (
                <Card
                  key={post.id}
                  className="p-3 cursor-pointer hover:bg-accent/50 transition"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <div className="flex gap-3">
                    {post.media_url && (
                      <img
                        src={post.media_url}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm mb-1">
                        {post.profiles?.display_name || post.profiles?.username}
                      </p>
                      {post.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.content}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
