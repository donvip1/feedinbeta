import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserAds, CreateAdParams } from '@/hooks/useUserAds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/navigation/BottomNav';
import { AdPreviewDevice } from '@/components/ads/AdPreviewDevice';
import { PostSelectorModal } from '@/components/ads/PostSelectorModal';
import { AdTargetingForm } from '@/components/ads/AdTargetingForm';
import { 
  ArrowLeft, 
  Coins, 
  Image as ImageIcon, 
  Play, 
  Loader2,
  Rocket,
  Clock,
  Eye,
  Target,
  Sparkles
} from 'lucide-react';

const CTA_OPTIONS = [
  'Shop Now',
  'Learn More',
  'Download',
  'Sign Up',
  'Contact Us',
  'Apply Now',
  'Book Now',
  'Get Quote',
  'Watch More',
  'Follow'
];

const PROMOTION_PLANS = [
  { id: 'starter', name: 'Starter', credits: 25, hours: 12, reach: '500+' },
  { id: 'basic', name: 'Basic', credits: 50, hours: 24, reach: '1,500+' },
  { id: 'pro', name: 'Pro', credits: 100, hours: 72, reach: '5,000+' },
  { id: 'premium', name: 'Premium', credits: 200, hours: 168, reach: '15,000+' },
  { id: 'elite', name: 'Elite', credits: 500, hours: 336, reach: '50,000+' },
];

const AdBuilder = () => {
  const { postId } = useParams<{ postId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createAd, creating } = useUserAds();

  // Form state
  const [brandName, setBrandName] = useState('');
  const [caption, setCaption] = useState('');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [clickUrl, setClickUrl] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(PROMOTION_PLANS[2]); // Pro default
  const [activeTab, setActiveTab] = useState('content');

  // Targeting state
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 45]);
  const [interests, setInterests] = useState<string[]>([]);
  const [genders, setGenders] = useState<string[]>(['All']);
  const [isGlobal, setIsGlobal] = useState(true);

  // Post selection state
  const [showPostSelector, setShowPostSelector] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    id: string;
    media_url: string | null;
    media_type: string | null;
    content: string | null;
  } | null>(null);

  // User data
  const [userBalance, setUserBalance] = useState(0);
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadUserData();
    if (postId) {
      loadPost(postId);
    }
  }, [user, postId]);

  const loadUserData = async () => {
    if (!user) return;

    const [balanceResult, profileResult] = await Promise.all([
      supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle()
    ]);

    if (balanceResult.data) {
      setUserBalance(balanceResult.data.balance);
    }
    if (profileResult.data) {
      setUserProfile(profileResult.data);
      setBrandName(profileResult.data.username || '');
    }
  };

  const loadPost = async (id: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select('id, media_url, media_type, content')
      .eq('id', id)
      .eq('user_id', user?.id)
      .maybeSingle();

    if (data) {
      setSelectedPost(data);
      setCaption(data.content || '');
    }
  };

  const handlePostSelect = (post: { id: string; media_url: string | null; media_type: string | null; content: string | null }) => {
    setSelectedPost(post);
    setCaption(post.content || '');
  };

  const handleCreateAd = async () => {
    if (!selectedPost?.media_url) {
      toast({
        title: 'Select a post',
        description: 'Please select a post with media to promote.',
        variant: 'destructive',
      });
      return;
    }

    if (!brandName.trim()) {
      toast({
        title: 'Brand name required',
        description: 'Please enter your brand or username.',
        variant: 'destructive',
      });
      return;
    }

    const params: CreateAdParams = {
      title: brandName,
      description: caption,
      mediaUrl: selectedPost.media_url,
      mediaType: selectedPost.media_type || 'image',
      clickUrl: clickUrl || undefined,
      ctaText,
      budgetCredits: selectedPlan.credits,
      durationHours: selectedPlan.hours,
      targetAgeMin: ageRange[0],
      targetAgeMax: ageRange[1],
      targetInterests: interests,
      targetGenders: genders.includes('All') ? [] : genders,
      postId: selectedPost.id,
    };

    const success = await createAd(params);
    if (success) {
      navigate('/ads/my-ads');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">Create Ad</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm">{userBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Preview Column */}
          <div className="order-1 lg:order-2">
            <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 sticky top-20">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Live Preview
              </h3>
              <AdPreviewDevice
                username={brandName || 'your_brand'}
                caption={caption || 'Your ad caption will appear here...'}
                ctaText={ctaText}
                mediaUrl={selectedPost?.media_url || undefined}
                mediaType={selectedPost?.media_type || undefined}
                profilePic={userProfile?.avatar_url || undefined}
                isPromoted={true}
              />
            </Card>
          </div>

          {/* Form Column */}
          <div className="order-2 lg:order-1 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content" className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="targeting" className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Targeting
                </TabsTrigger>
                <TabsTrigger value="budget" className="flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  Budget
                </TabsTrigger>
              </TabsList>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                {/* Post Selection */}
                <Card className="p-4">
                  <Label className="text-sm font-semibold mb-3 block">Select Post to Promote</Label>
                  {selectedPost ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary">
                      {selectedPost.media_type === 'video' ? (
                        <video
                          src={selectedPost.media_url || ''}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={selectedPost.media_url || ''}
                          alt="Selected post"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute top-2 right-2">
                        {selectedPost.media_type === 'video' ? (
                          <div className="bg-black/60 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                            <Play className="w-3 h-3" /> Video
                          </div>
                        ) : (
                          <div className="bg-black/60 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> Photo
                          </div>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-2 right-2"
                        onClick={() => setShowPostSelector(true)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-32 border-dashed"
                      onClick={() => setShowPostSelector(true)}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Sparkles className="w-8 h-8 text-muted-foreground" />
                        <span>Select a post to promote</span>
                      </div>
                    </Button>
                  )}
                </Card>

                {/* Brand Name */}
                <Card className="p-4">
                  <Label className="text-sm font-semibold mb-2 block">Brand Name</Label>
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="@your_brand"
                    maxLength={30}
                  />
                </Card>

                {/* Caption */}
                <Card className="p-4">
                  <Label className="text-sm font-semibold mb-2 block">Ad Caption</Label>
                  <Textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write an engaging caption for your ad..."
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{caption.length}/200</p>
                </Card>

                {/* CTA Button */}
                <Card className="p-4">
                  <Label className="text-sm font-semibold mb-2 block">Call to Action Button</Label>
                  <Select value={ctaText} onValueChange={setCtaText}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CTA_OPTIONS.map((cta) => (
                        <SelectItem key={cta} value={cta}>{cta}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>

                {/* Landing URL */}
                <Card className="p-4">
                  <Label className="text-sm font-semibold mb-2 block">Landing URL (Optional)</Label>
                  <Input
                    value={clickUrl}
                    onChange={(e) => setClickUrl(e.target.value)}
                    placeholder="https://your-website.com"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Where users go when they tap your CTA button
                  </p>
                </Card>
              </TabsContent>

              {/* Targeting Tab */}
              <TabsContent value="targeting" className="mt-4">
                <Card className="p-4">
                  <AdTargetingForm
                    ageRange={ageRange}
                    onAgeRangeChange={setAgeRange}
                    interests={interests}
                    onInterestsChange={setInterests}
                    genders={genders}
                    onGendersChange={setGenders}
                    isGlobal={isGlobal}
                    onIsGlobalChange={setIsGlobal}
                  />
                </Card>
              </TabsContent>

              {/* Budget Tab */}
              <TabsContent value="budget" className="space-y-4 mt-4">
                <Card className="p-4">
                  <Label className="text-sm font-semibold mb-3 block">Select Promotion Plan</Label>
                  <div className="space-y-3">
                    {PROMOTION_PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
                          selectedPlan.id === plan.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{plan.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {plan.hours < 24 ? `${plan.hours}h` : `${Math.round(plan.hours / 24)}d`}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {plan.reach} reach
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-bold text-lg">
                            <Coins className="w-4 h-4 text-amber-500" />
                            {plan.credits}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Balance Warning */}
                {userBalance < selectedPlan.credits && (
                  <Card className="p-4 bg-destructive/10 border-destructive/30">
                    <p className="text-sm text-destructive">
                      Insufficient credits. You need {selectedPlan.credits - userBalance} more credits.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => navigate('/wallet/credits')}
                    >
                      Buy Credits
                    </Button>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Launch Button */}
            <Button
              onClick={handleCreateAd}
              disabled={creating || !selectedPost || userBalance < selectedPlan.credits}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Ad...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Ad - {selectedPlan.credits} Credits
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      <PostSelectorModal
        open={showPostSelector}
        onOpenChange={setShowPostSelector}
        onSelect={handlePostSelect}
      />

      <BottomNav />
    </div>
  );
};

export default AdBuilder;
