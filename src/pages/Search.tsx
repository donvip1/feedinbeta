import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon, TrendingUp, Clock, Hash, Users as UsersIcon, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import PostCard from '@/components/feed/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/navigation/BottomNav';
import { sanitizeSearchQuery } from '@/lib/search-utils';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

const RECENT_SEARCHES_KEY = 'feedin_recent_searches';
const MAX_RECENT_SEARCHES = 10;

const Search = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Save search to recent
  const saveToRecent = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const removeRecentSearch = (search: string) => {
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // Fetch trending hashtags
  const { data: trendingHashtags } = useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: async () => {
      const { data } = await supabase
        .from('hashtags')
        .select('*')
        .eq('is_trending', true)
        .order('trending_score', { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  // Fetch suggested users to follow
  const { data: suggestedUsers } = useQuery({
    queryKey: ['suggested-users', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get users we're not following with most followers
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      
      const followingIds = following?.map(f => f.following_id) || [];
      followingIds.push(user.id); // Exclude self
      
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .not('id', 'in', `(${followingIds.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(5);
      
      return data || [];
    },
    enabled: !!user && !query.trim(),
  });

  useEffect(() => {
    if (query.trim()) {
      handleSearch();
    } else {
      setHasSearched(false);
      setPosts([]);
      setUsers([]);
      setHashtags([]);
    }
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    
    try {
      let postsData: any[] = [];
      const safeQuery = sanitizeSearchQuery(query);
      
      // Check if searching for a hashtag
      if (query.trim().startsWith('#')) {
        const hashtagName = sanitizeSearchQuery(query.trim().slice(1).toLowerCase());
        
        const { data: hashtagData } = await supabase
          .from('hashtags')
          .select('id')
          .ilike('name', hashtagName)
          .maybeSingle();

        if (hashtagData) {
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
              .limit(30);

            postsData = posts || [];
          }
        }
      } else {
        // Full-text search in posts content
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
          .limit(30);

        postsData = posts || [];
      }

      // Search users
      const safeUserQuery = sanitizeSearchQuery(query.replace('#', ''));
      const { data: usersData } = await supabase
        .from('public_profiles')
        .select('*')
        .or(`username.ilike.%${safeUserQuery}%,display_name.ilike.%${safeUserQuery}%`)
        .limit(30);

      // Search hashtags
      const { data: hashtagsData } = await supabase
        .from('hashtags')
        .select('*')
        .ilike('name', `%${safeUserQuery}%`)
        .order('posts_count', { ascending: false })
        .limit(30);

      setPosts(postsData);
      setUsers(usersData || []);
      setHashtags(hashtagsData || []);
      
      // Save to recent searches
      saveToRecent(query);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (searchTerm: string) => {
    setQuery(searchTerm);
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
              {query && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setQuery('')}
                  className="absolute right-8 top-0 h-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSearch}
                className="absolute right-0 top-0 h-full"
              >
                <SearchIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-4 max-w-2xl">
          {!hasSearched && !query.trim() ? (
            // Discovery mode - show trending and suggestions
            <div className="space-y-6">
              {/* Trending Hashtags */}
              {trendingHashtags && trendingHashtags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">Trending</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendingHashtags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1.5"
                        onClick={() => handleQuickSearch(`#${tag.name}`)}
                      >
                        <Hash className="w-3 h-3 mr-1" />
                        {tag.name}
                        <span className="ml-2 text-xs opacity-70">{tag.posts_count || 0}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <h2 className="font-semibold">Recent Searches</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearRecentSearches}>
                      Clear all
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer group"
                        onClick={() => handleQuickSearch(search)}
                      >
                        <div className="flex items-center gap-3">
                          <SearchIcon className="w-4 h-4 text-muted-foreground" />
                          <span>{search}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(search);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Users */}
              {suggestedUsers && suggestedUsers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <UsersIcon className="w-5 h-5 text-muted-foreground" />
                    <h2 className="font-semibold">People to Follow</h2>
                  </div>
                  <div className="space-y-2">
                    {suggestedUsers.map((profile) => (
                      <div
                        key={profile.id}
                        onClick={() => navigate(`/profile/${profile.username || profile.id}`)}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                      >
                        <Avatar>
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{profile.display_name}</p>
                          <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Search Filters */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-semibold">Explore</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => navigate('/feed/trending')}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Trending Posts
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => handleQuickSearch('#tech')}
                  >
                    <Hash className="w-4 h-4" />
                    #tech
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => handleQuickSearch('#music')}
                  >
                    <Hash className="w-4 h-4" />
                    #music
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => handleQuickSearch('#art')}
                  >
                    <Hash className="w-4 h-4" />
                    #art
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Search results mode
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="posts" className="flex-1 gap-1">
                  <FileText className="w-3 h-3" />
                  Posts ({posts.length})
                </TabsTrigger>
                <TabsTrigger value="users" className="flex-1 gap-1">
                  <UsersIcon className="w-3 h-3" />
                  Users ({users.length})
                </TabsTrigger>
                <TabsTrigger value="hashtags" className="flex-1 gap-1">
                  <Hash className="w-3 h-3" />
                  Tags ({hashtags.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="space-y-4 mt-4">
                {loading ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Searching...</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No posts found for "{query}"</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Try different keywords</p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="users" className="space-y-3 mt-4">
                {loading ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Searching...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12">
                    <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No users found for "{query}"</p>
                  </div>
                ) : (
                  users.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => navigate(`/profile/${profile.username || profile.id}`)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                    >
                      <Avatar>
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{profile.display_name}</p>
                        <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="hashtags" className="space-y-2 mt-4">
                {loading ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Searching...</p>
                  </div>
                ) : hashtags.length === 0 ? (
                  <div className="text-center py-12">
                    <Hash className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No hashtags found for "{query}"</p>
                  </div>
                ) : (
                  hashtags.map((tag) => (
                    <div
                      key={tag.id}
                      onClick={() => navigate(`/feed/hashtag/${tag.name}`)}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Hash className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">#{tag.name}</p>
                          <p className="text-sm text-muted-foreground">{tag.posts_count || 0} posts</p>
                        </div>
                      </div>
                      {tag.is_trending && (
                        <Badge variant="secondary" className="gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Trending
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Search;
