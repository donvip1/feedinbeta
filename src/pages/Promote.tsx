import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, TrendingUp, Users, Eye, Zap, Target, Globe, Clock, 
  BarChart3, Sparkles, Crown, Rocket, Star, Heart, MessageCircle,
  Share2, Bookmark, Calendar, MapPin, CheckCircle2, Info
} from 'lucide-react';

interface Post {
  id: string;
  feed_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  views_count: number;
  comments_count: number;
  shares_count: number;
  post_type: string | null;
  original_post_id: string | null;
  user_id: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  original_post?: {
    id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    profiles?: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  } | null;
}

interface PromotionPlan {
  id: string;
  name: string;
  cost: number;
  reach: string;
  duration: string;
  features: string[];
  icon: React.ReactNode;
  gradient: string;
  popular?: boolean;
  premium?: boolean;
}

const promotionPlans: PromotionPlan[] = [
  {
    id: 'starter',
    name: 'Starter Boost',
    cost: 25,
    reach: '500+',
    duration: '12 hours',
    features: ['Basic visibility boost', 'For You feed placement'],
    icon: <Zap className="w-6 h-6" />,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'basic',
    name: 'Basic Boost',
    cost: 50,
    reach: '1,500+',
    duration: '24 hours',
    features: ['Enhanced visibility', 'For You feed priority', 'Trending section chance'],
    icon: <TrendingUp className="w-6 h-6" />,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'pro',
    name: 'Pro Boost',
    cost: 100,
    reach: '5,000+',
    duration: '3 days',
    features: ['Maximum visibility', 'Top For You placement', 'Trending page feature', 'Analytics dashboard'],
    icon: <Rocket className="w-6 h-6" />,
    gradient: 'from-pink-500 to-rose-500',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium Boost',
    cost: 200,
    reach: '15,000+',
    duration: '7 days',
    features: ['Viral potential unlock', 'All feed priority', 'Guaranteed trending', 'Full analytics', 'Creator badge boost'],
    icon: <Crown className="w-6 h-6" />,
    gradient: 'from-amber-500 to-orange-500',
    premium: true,
  },
  {
    id: 'elite',
    name: 'Elite Campaign',
    cost: 500,
    reach: '50,000+',
    duration: '14 days',
    features: ['Platform-wide reach', 'Push notification feature', 'Homepage spotlight', 'VIP analytics', 'Priority support', 'Influencer network'],
    icon: <Sparkles className="w-6 h-6" />,
    gradient: 'from-rose-500 to-red-500',
    premium: true,
  },
];

const audienceInterests = [
  'Technology', 'Gaming', 'Music', 'Sports', 'Fashion', 'Food', 
  'Travel', 'Fitness', 'Art', 'Photography', 'Business', 'Education'
];

const Promote = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number>(0);
  const [promoting, setPromoting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [activeTab, setActiveTab] = useState('plans');
  
  // Targeting options
  const [targetAge, setTargetAge] = useState([18, 45]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [globalReach, setGlobalReach] = useState(true);
  const [schedulePromotion, setSchedulePromotion] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (postId) {
      loadPost();
      loadCredits();
    }
  }, [user, postId]);

  const loadCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCredits(data?.balance || 0);
    } catch (error) {
      console.error('Error loading credits:', error);
    }
  };

  const loadPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      
      // If it's a refeed/quote, fetch original post data
      if (data.original_post_id) {
        const { data: originalData } = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            content,
            media_url,
            media_type,
            profiles (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('id', data.original_post_id)
          .single();
        
        (data as any).original_post = originalData;
      }
      
      setPost(data as Post);
    } catch (error: any) {
      toast({
        title: 'Error loading post',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    const plan = promotionPlans.find(p => p.id === selectedPlan);
    if (!plan || promoting) return;

    if (credits < plan.cost) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${plan.cost} credits. You have ${credits} credits.`,
        variant: 'destructive',
      });
      return;
    }

    setPromoting(true);
    try {
      // Determine if we're promoting someone else's content
      const isPromotingOthersContent = post?.original_post && user?.id !== post.original_post.user_id;
      const originalAuthorId = post?.original_post?.user_id || null;

      const { data, error } = await supabase.rpc('promote_post', {
        p_post_id: postId,
        p_plan_name: plan.name,
        p_cost: plan.cost,
        p_original_author_id: originalAuthorId || undefined,
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        new_balance?: number;
        original_author_credited?: boolean;
        author_credit?: number;
      } | null;
      
      if (result?.new_balance !== undefined) {
        setCredits(result.new_balance);
      } else {
        setCredits(credits - plan.cost);
      }

      const authorName = post?.original_post?.profiles?.display_name || post?.original_post?.profiles?.username || 'the creator';
      
      toast({
        title: '🚀 Post Promoted!',
        description: isPromotingOthersContent 
          ? `You promoted ${authorName}'s content! They earned ${result?.author_credit || Math.floor(plan.cost * 0.2)} credits. Reach: ${plan.reach} users.`
          : `Your post is now boosted with ${plan.name}. Reach: ${plan.reach} users for ${plan.duration}.`,
      });

      setTimeout(() => navigate(`/feed/post/${postId}`), 2000);
    } catch (error: any) {
      toast({
        title: 'Promotion Failed',
        description: error.message || 'Failed to promote post',
        variant: 'destructive',
      });
    } finally {
      setPromoting(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const currentPlan = promotionPlans.find(p => p.id === selectedPlan);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">Post not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                // Check for passed return path, use navigate(-1), or fallback to post detail
                const returnTo = (location.state as any)?.returnTo;
                if (returnTo) {
                  // Navigate back with preserveFeed to prevent feed randomization
                  navigate(returnTo, { state: { preserveFeed: true } });
                } else if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate(`/feed/post/${postId}`, { replace: true });
                }
              }}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Promote Post
              </h1>
              <p className="text-xs text-muted-foreground">Reach more people</p>
            </div>
          </div>
          
          {/* Credits Display */}
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-bold text-primary">{credits}</span>
            <span className="text-xs text-muted-foreground">credits</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Attribution Notice for promoting others' content */}
        {post.original_post && user?.id !== post.original_post.user_id && (
          <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/30 p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Supporting a Creator
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You're promoting <span className="font-semibold text-foreground">
                    {post.original_post.profiles?.display_name || post.original_post.profiles?.username || 'a creator'}
                  </span>'s content. They'll receive <span className="font-semibold text-emerald-600 dark:text-emerald-400">20% of your promotion cost</span> as attribution credits, plus all engagement benefits.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Post Preview Card */}
        <Card className="bg-card/50 backdrop-blur border-border p-4 mb-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
          <div className="relative">
            {/* Show original creator for refeeds */}
            {post.original_post ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                  {post.original_post.profiles?.display_name?.[0] || 'U'}
                </div>
                <div>
                  <p className="font-semibold">{post.original_post.profiles?.display_name || 'Creator'}</p>
                  <p className="text-xs text-muted-foreground">@{post.original_post.profiles?.username || 'user'} · Original Creator</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Original Post</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                  {post.profiles?.display_name?.[0] || 'U'}
                </div>
                <div>
                  <p className="font-semibold">{post.profiles?.display_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">@{post.profiles?.username || 'user'}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Preview</Badge>
              </div>
            )}
            
            {/* Show original content for refeeds */}
            {post.original_post ? (
              <>
                {post.original_post.content && (
                  <p className="text-sm mb-3 line-clamp-2">{post.original_post.content}</p>
                )}
                {post.original_post.media_url && (
                  <div className="relative h-40 rounded-xl overflow-hidden bg-muted mb-3">
                    {post.original_post.media_type === 'image' ? (
                      <img src={post.original_post.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.original_post.media_url} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {post.content && post.media_type !== 'text_styled' && (
                  <p className="text-sm mb-3 line-clamp-2">{post.content}</p>
                )}
                {post.media_url && post.media_type !== 'text_styled' && (
                  <div className="relative h-40 rounded-xl overflow-hidden bg-muted mb-3">
                    {post.media_type === 'image' ? (
                      <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={post.media_url} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
              </>
            )}
            
            {/* Current Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {post.views_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4" /> {post.likes_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" /> {post.comments_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Share2 className="w-4 h-4" /> {post.shares_count || 0}
              </span>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="plans" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Rocket className="w-4 h-4 mr-2" /> Plans
            </TabsTrigger>
            <TabsTrigger value="targeting" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Target className="w-4 h-4 mr-2" /> Targeting
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" /> Preview
            </TabsTrigger>
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="mt-4 space-y-4">
            {promotionPlans.map((plan) => (
              <Card 
                key={plan.id}
                className={`relative overflow-hidden cursor-pointer transition-all duration-300 ${
                  selectedPlan === plan.id 
                    ? 'ring-2 ring-primary scale-[1.02]' 
                    : 'hover:scale-[1.01]'
                } ${plan.premium ? 'shimmer-effect' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} opacity-10`} />
                
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-semibold">
                    POPULAR
                  </div>
                )}
                {plan.premium && !plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-3 py-1 rounded-bl-lg font-semibold">
                    PREMIUM
                  </div>
                )}
                
                <div className="relative p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center text-white ${selectedPlan === plan.id ? 'promote-glow' : ''}`}>
                        {plan.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">Reach {plan.reach} users</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                        {plan.cost}
                      </p>
                      <p className="text-xs text-muted-foreground">credits</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{plan.duration}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className={`w-4 h-4 text-${plan.gradient.split('-')[1]}-500`} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  {selectedPlan === plan.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Selected plan</span>
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Targeting Tab */}
          <TabsContent value="targeting" className="mt-4 space-y-6">
            {/* Age Range */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Age Range</h3>
              </div>
              <div className="space-y-4">
                <Slider
                  value={targetAge}
                  onValueChange={setTargetAge}
                  min={13}
                  max={65}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{targetAge[0]} years</span>
                  <span>{targetAge[1]}+ years</span>
                </div>
              </div>
            </Card>

            {/* Interests */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Interests</h3>
                <Badge variant="secondary" className="ml-auto">{selectedInterests.length} selected</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {audienceInterests.map((interest) => (
                  <Badge
                    key={interest}
                    variant={selectedInterests.includes(interest) ? "default" : "outline"}
                    className="cursor-pointer transition-all hover:scale-105"
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </Card>

            {/* Location */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Global Reach</h3>
                    <p className="text-sm text-muted-foreground">Show to users worldwide</p>
                  </div>
                </div>
                <Switch checked={globalReach} onCheckedChange={setGlobalReach} />
              </div>
            </Card>

            {/* Schedule */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Schedule Promotion</h3>
                    <p className="text-sm text-muted-foreground">Start at a specific time</p>
                  </div>
                </div>
                <Switch checked={schedulePromotion} onCheckedChange={setSchedulePromotion} />
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Preview Tab */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Estimated Performance</h3>
              </div>
              
              {currentPlan && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Eye className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-bold">{currentPlan.reach}</p>
                    <p className="text-sm text-muted-foreground">Estimated Views</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Heart className="w-8 h-8 mx-auto text-red-500 mb-2" />
                    <p className="text-2xl font-bold">{parseInt(currentPlan.reach.replace(/[^0-9]/g, '')) * 0.05}+</p>
                    <p className="text-sm text-muted-foreground">Estimated Likes</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <MessageCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                    <p className="text-2xl font-bold">{parseInt(currentPlan.reach.replace(/[^0-9]/g, '')) * 0.02}+</p>
                    <p className="text-sm text-muted-foreground">Estimated Comments</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Users className="w-8 h-8 mx-auto text-purple-500 mb-2" />
                    <p className="text-2xl font-bold">{parseInt(currentPlan.reach.replace(/[^0-9]/g, '')) * 0.01}+</p>
                    <p className="text-sm text-muted-foreground">New Followers</p>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-5 bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Pro Tip</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Posts with high-quality visuals and engaging captions typically see 3x more engagement during promotions.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bottom Action */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border p-4">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground">Selected Plan</p>
                <p className="font-bold">{currentPlan?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold text-primary">{currentPlan?.cost} credits</p>
              </div>
            </div>
            <Button
              onClick={handlePromote}
              disabled={promoting || !currentPlan || credits < (currentPlan?.cost || 0)}
              className={`w-full h-12 text-lg font-semibold bg-gradient-to-r ${currentPlan?.gradient || 'from-primary to-accent'} hover:opacity-90 transition-opacity`}
            >
              {promoting ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Promoting...
                </span>
              ) : credits < (currentPlan?.cost || 0) ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Insufficient Credits
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  {post?.original_post && user?.id !== post.original_post.user_id
                    ? `Support Creator for ${currentPlan?.cost} Credits`
                    : `Boost Now for ${currentPlan?.cost} Credits`
                  }
                </span>
              )}
            </Button>
            {credits < (currentPlan?.cost || 0) && (
              <Button
                variant="link"
                className="w-full mt-2 text-primary"
                onClick={() => navigate('/wallet')}
              >
                Get more credits →
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Promote;