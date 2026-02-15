import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/navigation/BottomNav';
import { BackButton } from '@/components/navigation/BackButton';
import { 
  ArrowLeft, Rocket, TrendingUp, Users, Eye, Clock, 
  MessageCircle, Heart, Play, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Promotion {
  id: string;
  post_id: string;
  user_id: string;
  credits_spent: number;
  boost_level: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  post: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    likes_count: number;
    views_count: number;
    comments_count: number;
    user_id: string;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  promoter: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Promotions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [myPromotions, setMyPromotions] = useState<Promotion[]>([]);
  const [promotedByOthers, setPromotedByOthers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-promotions');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadPromotions();
  }, [user]);

  const loadPromotions = async () => {
    if (!user) return;
    
    try {
      // Load promotions I made
      const { data: myData, error: myError } = await supabase
        .from('post_promotions')
        .select(`
          *,
          post:posts (
            id,
            content,
            media_url,
            media_type,
            likes_count,
            views_count,
            comments_count,
            user_id,
            profiles (
              display_name,
              username,
              avatar_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (myError) throw myError;

      // Load promotions of my content by others
      const { data: myPostIds } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id);

      const postIds = myPostIds?.map(p => p.id) || [];

      let othersData: any[] = [];
      if (postIds.length > 0) {
        const { data, error } = await supabase
          .from('post_promotions')
          .select(`
            *,
            post:posts (
              id,
              content,
              media_url,
              media_type,
              likes_count,
              views_count,
              comments_count,
              user_id,
              profiles (
                display_name,
                username,
                avatar_url
              )
            ),
            promoter:profiles!post_promotions_user_id_fkey (
              display_name,
              username,
              avatar_url
            )
          `)
          .in('post_id', postIds)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error) {
          othersData = data || [];
        }
      }

      setMyPromotions((myData || []) as any);
      setPromotedByOthers(othersData as any);
    } catch (error: any) {
      toast({
        title: 'Error loading promotions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMessagePromoter = (promoterUsername: string) => {
    navigate('/messages', { state: { startChatWith: promoterUsername } });
  };

  const PromotionCard = ({ promotion, showPromoter = false }: { promotion: Promotion; showPromoter?: boolean }) => {
    const post = promotion.post;
    const isActive = new Date(promotion.expires_at) > new Date();
    
    return (
      <Card 
        className="overflow-hidden hover:shadow-lg transition-all cursor-pointer"
        onClick={() => navigate(`/feed/post/${post.id}`)}
      >
        <div className="flex gap-4 p-4">
          {/* Post Thumbnail */}
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {post.media_url ? (
              post.media_type === 'video' ? (
                <>
                  <video 
                    src={post.media_url} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </>
              ) : (
                <img 
                  src={post.media_url} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Creator info */}
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="w-5 h-5">
                <AvatarImage src={post.profiles?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {post.profiles?.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate">
                {post.profiles?.display_name || post.profiles?.username || 'User'}
              </span>
              <Badge 
                variant={isActive ? "default" : "secondary"} 
                className={`ml-auto text-xs ${isActive ? 'bg-emerald-500' : ''}`}
              >
                {isActive ? 'Active' : 'Ended'}
              </Badge>
            </div>

            {/* Post content preview */}
            {post.content && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {post.content}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {promotion.credits_spent} credits
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {post.views_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {post.likes_count || 0}
              </span>
            </div>

            {/* Promoter info (for content promoted by others) */}
            {showPromoter && promotion.promoter && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={promotion.promoter.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {promotion.promoter.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Promoted by <span className="font-medium text-foreground">
                        {promotion.promoter.display_name || promotion.promoter.username}
                      </span>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMessagePromoter(promotion.promoter.username || '');
                    }}
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    Thank
                  </Button>
                </div>
              </div>
            )}

            {/* Time info */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {isActive ? (
                <span>Expires {formatDistanceToNow(new Date(promotion.expires_at), { addSuffix: true })}</span>
              ) : (
                <span>Ended {formatDistanceToNow(new Date(promotion.expires_at), { addSuffix: true })}</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton fallback="/feed" className="text-muted-foreground hover:text-foreground" />
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Promotions
            </h1>
            <p className="text-xs text-muted-foreground">Track your promoted content</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="my-promotions" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              My Promotions
              {myPromotions.length > 0 && (
                <Badge variant="secondary" className="ml-1">{myPromotions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="promoted-by-others" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              By Others
              {promotedByOthers.length > 0 && (
                <Badge variant="secondary" className="ml-1">{promotedByOthers.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-promotions" className="space-y-4">
            {myPromotions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Rocket className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No promotions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Promote your posts to reach more people
                </p>
                <Button 
                  onClick={() => navigate('/feed')} 
                  className="mt-4"
                >
                  Browse Feed
                </Button>
              </div>
            ) : (
              myPromotions.map(promotion => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))
            )}
          </TabsContent>

          <TabsContent value="promoted-by-others" className="space-y-4">
            {promotedByOthers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No promotions from others</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When others promote your content, it will appear here
                </p>
              </div>
            ) : (
              promotedByOthers.map(promotion => (
                <PromotionCard key={promotion.id} promotion={promotion} showPromoter />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default Promotions;
