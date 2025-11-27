import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, Users, Eye, Zap } from 'lucide-react';

interface Post {
  id: string;
  feed_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  views_count: number;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Promote = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number>(0);
  const [promoting, setPromoting] = useState(false);

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
      setPost(data);
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

  const handlePromote = async (plan: string, cost: number) => {
    if (promoting) return;

    // Check if user has enough credits
    if (credits < cost) {
      toast({
        title: 'Insufficient Credits',
        description: `You need ${cost} credits to promote with ${plan}. You currently have ${credits} credits.`,
        variant: 'destructive',
      });
      return;
    }

    setPromoting(true);
    try {
      // Deduct credits
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user?.id,
          amount: -cost,
          type: 'spent',
          description: `${plan} - Post promotion`,
          related_id: postId,
        });

      if (transactionError) throw transactionError;

      // Update credits display
      setCredits(credits - cost);

      toast({
        title: 'Post Promoted!',
        description: `Your post has been promoted with ${plan}. ${cost} credits deducted.`,
      });

      // Navigate back after short delay
      setTimeout(() => {
        navigate('/feed');
      }, 2000);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
          <div className="container mx-auto px-4 py-3">
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Post not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold ml-4">Promote Post</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-20">
        {/* Credits Display */}
        <Card className="bg-gradient-to-r from-primary/20 to-accent/20 border-primary/50 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Credits</p>
              <p className="text-2xl font-bold text-primary">{credits}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/wallet')}
            >
              Buy More
            </Button>
          </div>
        </Card>

        {/* Post Preview */}
        <Card className="bg-gray-900 border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gradient-primary">Your Post</h2>
          
          {/* Caption for non-styled text posts */}
          {post.content && post.media_type !== 'text_styled' && (
            <p className="text-white mb-4">{post.content}</p>
          )}

          {/* Text posts with styled background (gradient/solid) */}
          {post.media_type === 'text_styled' && post.media_url && post.content ? (
            <div className={`${post.media_url} rounded-lg overflow-hidden border border-border mb-4`}>
              <div className="w-full h-[400px] flex items-center justify-center p-8">
                <p className="text-white text-2xl md:text-3xl font-bold text-center leading-relaxed">
                  {post.content}
                </p>
              </div>
            </div>
          ) : post.media_url && post.media_type !== 'text_styled' ? (
            <div className="mb-4 rounded-xl overflow-hidden bg-card border border-border">
              <div className="w-full relative h-[400px]">
                {post.media_type === 'image' ? (
                  <img 
                    src={post.media_url} 
                    alt="Post content" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video 
                    src={post.media_url} 
                    className="w-full h-full object-cover" 
                    controls 
                  />
                )}
              </div>
            </div>
          ) : null}

          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{post.views_count} views</span>
            </span>
            <span className="flex items-center space-x-1">
              <TrendingUp className="w-4 h-4" />
              <span>{post.likes_count} likes</span>
            </span>
          </div>
        </Card>

        {/* Promotion Plans */}
        <h2 className="text-2xl font-bold mb-4">Choose a Promotion Plan</h2>
        
        <div className="space-y-4">
          {/* Basic Plan */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 p-6 hover:border-blue-500 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-blue-500" />
                  Basic Boost
                </h3>
                <p className="text-gray-400 text-sm mt-1">Show your post to more people</p>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                50 Credits
              </span>
            </div>
            <ul className="space-y-2 mb-4 text-gray-300 text-sm">
              <li className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-blue-500" />
                Reach 1,000+ users
              </li>
              <li className="flex items-center">
                <Eye className="w-4 h-4 mr-2 text-blue-500" />
                24 hours featured
              </li>
            </ul>
            <Button
              onClick={() => handlePromote('Basic Boost', 50)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              disabled={promoting || credits < 50}
            >
              {promoting ? 'Processing...' : credits < 50 ? 'Insufficient Credits' : 'Promote Now'}
            </Button>
          </Card>

          {/* Pro Plan */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 p-6 hover:border-purple-500 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-purple-500" />
                  Pro Boost
                </h3>
                <p className="text-gray-400 text-sm mt-1">Maximum visibility & engagement</p>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                100 Credits
              </span>
            </div>
            <ul className="space-y-2 mb-4 text-gray-300 text-sm">
              <li className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-purple-500" />
                Reach 5,000+ users
              </li>
              <li className="flex items-center">
                <Eye className="w-4 h-4 mr-2 text-purple-500" />
                72 hours featured
              </li>
              <li className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-purple-500" />
                Priority in "For You" feed
              </li>
            </ul>
            <Button
              onClick={() => handlePromote('Pro Boost', 100)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              disabled={promoting || credits < 100}
            >
              {promoting ? 'Processing...' : credits < 100 ? 'Insufficient Credits' : 'Promote Now'}
            </Button>
          </Card>

          {/* Premium Plan */}
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 p-6 hover:border-yellow-500 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                  Premium Boost
                </h3>
                <p className="text-gray-400 text-sm mt-1">Go viral with maximum exposure</p>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                200 Credits
              </span>
            </div>
            <ul className="space-y-2 mb-4 text-gray-300 text-sm">
              <li className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-yellow-500" />
                Reach 10,000+ users
              </li>
              <li className="flex items-center">
                <Eye className="w-4 h-4 mr-2 text-yellow-500" />
                7 days featured
              </li>
              <li className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-yellow-500" />
                Top placement in all feeds
              </li>
              <li className="flex items-center">
                <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                Trending page feature
              </li>
            </ul>
            <Button
              onClick={() => handlePromote('Premium Boost', 200)}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              disabled={promoting || credits < 200}
            >
              {promoting ? 'Processing...' : credits < 200 ? 'Insufficient Credits' : 'Promote Now'}
            </Button>
          </Card>
        </div>

        {/* Info Note */}
        <Card className="bg-blue-500/10 border-blue-500/30 p-4 mt-6">
          <p className="text-sm text-blue-300">
            💡 <strong>Tip:</strong> Promoted posts get shown to users who are most likely to engage with your content based on their interests and activity.
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Promote;
