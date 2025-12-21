import { ArrowLeft, Check, X, Star, Zap, DollarSign, Users, Sparkles, Shield, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const CompetitiveAnalysis = () => {
  const navigate = useNavigate();

  const platforms = [
    { name: 'FeedIn', color: 'hsl(var(--primary))' },
    { name: 'TikTok', color: '#000000' },
    { name: 'Instagram', color: '#E4405F' },
    { name: 'YouTube', color: '#FF0000' },
    { name: 'X/Twitter', color: '#1DA1F2' },
    { name: 'Snapchat', color: '#FFFC00' }
  ];

  const platformFees = [
    { platform: 'FeedIn', fee: 15, color: 'hsl(var(--primary))' },
    { platform: 'TikTok', fee: 50, color: '#69C9D0' },
    { platform: 'Instagram', fee: 30, color: '#E4405F' },
    { platform: 'YouTube', fee: 30, color: '#FF0000' },
    { platform: 'Twitch', fee: 50, color: '#9146FF' },
    { platform: 'OnlyFans', fee: 20, color: '#00AFF0' }
  ];

  const monetizationRequirements = [
    { 
      platform: 'FeedIn', 
      requirement: 'None - Earn from Day 1',
      followers: 0,
      additionalReqs: 'No minimum requirements',
      highlight: true
    },
    { 
      platform: 'TikTok Creator Fund', 
      requirement: '10,000 Followers',
      followers: 10000,
      additionalReqs: '100K views in 30 days'
    },
    { 
      platform: 'Instagram Subscriptions', 
      requirement: '10,000 Followers',
      followers: 10000,
      additionalReqs: 'Professional account required'
    },
    { 
      platform: 'YouTube Partner', 
      requirement: '1,000 Subscribers',
      followers: 1000,
      additionalReqs: '4,000 watch hours OR 10M Shorts views'
    },
    { 
      platform: 'Twitch Affiliate', 
      requirement: '50 Followers',
      followers: 50,
      additionalReqs: '500 min broadcast, 7 unique days, 3 avg viewers'
    }
  ];

  const featureComparison = [
    { feature: 'Short-form Video', feedin: true, tiktok: true, instagram: true, youtube: true, twitter: true, snapchat: true },
    { feature: 'Long-form Video', feedin: true, tiktok: false, instagram: false, youtube: true, twitter: false, snapchat: false },
    { feature: 'Stories', feedin: true, tiktok: false, instagram: true, youtube: true, twitter: true, snapchat: true },
    { feature: 'Live Streaming', feedin: true, tiktok: true, instagram: true, youtube: true, twitter: true, snapchat: true },
    { feature: 'Direct Messaging', feedin: true, tiktok: true, instagram: true, youtube: false, twitter: true, snapchat: true },
    { feature: 'Groups/Communities', feedin: true, tiktok: false, instagram: false, youtube: true, twitter: true, snapchat: false },
    { feature: 'In-app Gifting', feedin: true, tiktok: true, instagram: false, youtube: true, twitter: false, snapchat: true },
    { feature: 'Built-in AI Tools', feedin: true, tiktok: false, instagram: false, youtube: false, twitter: false, snapchat: true },
    { feature: 'Credit Economy', feedin: true, tiktok: false, instagram: false, youtube: false, twitter: false, snapchat: false },
    { feature: 'P2P Marketplace', feedin: true, tiktok: false, instagram: false, youtube: false, twitter: false, snapchat: false },
    { feature: 'No Follower Thresholds', feedin: true, tiktok: false, instagram: false, youtube: false, twitter: false, snapchat: false },
    { feature: 'Voice/Video Calls', feedin: true, tiktok: false, instagram: true, youtube: false, twitter: false, snapchat: true }
  ];

  const uniqueAdvantages = [
    {
      icon: DollarSign,
      title: 'Earn from Day One',
      description: 'No follower minimums, watch hour requirements, or waiting periods. Every creator can monetize immediately through gifts, tips, and premium content.',
      color: 'text-green-500'
    },
    {
      icon: Zap,
      title: 'Integrated AI Tools',
      description: 'Built-in AI chat assistant, image generation, and enhancement tools. No need for external subscriptions or tools.',
      color: 'text-purple-500'
    },
    {
      icon: Users,
      title: 'P2P Credit Marketplace',
      description: 'Users can trade credits directly with each other at market rates, creating a true creator economy ecosystem.',
      color: 'text-blue-500'
    },
    {
      icon: Shield,
      title: 'Lower Platform Fees',
      description: 'Only 10-15% transaction fees compared to 30-50% on competing platforms. Creators keep more of what they earn.',
      color: 'text-amber-500'
    },
    {
      icon: Sparkles,
      title: 'Unified Platform',
      description: 'All social features in one app: feed, stories, live streaming, messaging, groups, and AI tools. No fragmentation.',
      color: 'text-pink-500'
    },
    {
      icon: TrendingUp,
      title: 'Modern Tech Stack',
      description: 'Built with cutting-edge technology: PWA support, WebRTC for real-time features, and optimized for mobile performance.',
      color: 'text-cyan-500'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4 max-w-6xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Competitive Analysis</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 pb-24 space-y-8">
        {/* Hero Section */}
        <div className="text-center py-8 space-y-4">
          <Badge variant="outline" className="text-primary border-primary">
            Why FeedIn?
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold">
            A Better Platform for{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Creators
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See how FeedIn compares to major social platforms and why we're building the future of creator monetization.
          </p>
        </div>

        {/* Unique Advantages */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-amber-500" />
            What Makes FeedIn Different
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueAdvantages.map((advantage, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-secondary ${advantage.color}`}>
                      <advantage.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{advantage.title}</h4>
                      <p className="text-sm text-muted-foreground">{advantage.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Tabs defaultValue="fees" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="fees">Platform Fees</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          {/* Platform Fees Comparison */}
          <TabsContent value="fees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Creator Payout Rates (What Creators Keep)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformFees.map(p => ({ ...p, keeps: 100 - p.fee }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="platform" type="category" width={100} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value}%`, 'Creator Keeps']}
                      />
                      <Bar dataKey="keeps" radius={[0, 4, 4, 0]}>
                        {platformFees.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm">
                    <strong className="text-primary">FeedIn Advantage:</strong> Creators keep up to 85-90% of their earnings, 
                    compared to just 50% on platforms like TikTok and Twitch.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {platformFees.map((platform, index) => (
                <Card key={index} className={platform.platform === 'FeedIn' ? 'border-primary/50 bg-primary/5' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: platform.color }}
                        />
                        <span className="font-medium">{platform.platform}</span>
                        {platform.platform === 'FeedIn' && (
                          <Badge className="bg-primary/20 text-primary border-0">Best</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{100 - platform.fee}%</p>
                        <p className="text-xs text-muted-foreground">Creator keeps</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Monetization Requirements */}
          <TabsContent value="requirements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Monetization Requirements Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monetizationRequirements.map((platform, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${
                        platform.highlight 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-secondary/30 border-border/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{platform.platform}</span>
                          {platform.highlight && (
                            <Badge className="bg-green-500/20 text-green-500 border-0">
                              <Check className="h-3 w-3 mr-1" />
                              No Barriers
                            </Badge>
                          )}
                        </div>
                        <span className={`font-bold ${platform.highlight ? 'text-primary' : ''}`}>
                          {platform.requirement}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{platform.additionalReqs}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">The FeedIn Difference</h4>
                    <p className="text-muted-foreground">
                      While other platforms require thousands of followers and months of effort before you can earn a single dollar, 
                      FeedIn lets you start monetizing from your very first post. Receive gifts, accept tips, and build your 
                      audience while earning—not after.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature Comparison Matrix */}
          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Comparison Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium">Feature</th>
                        <th className="text-center py-3 px-2 font-medium text-primary">FeedIn</th>
                        <th className="text-center py-3 px-2 font-medium">TikTok</th>
                        <th className="text-center py-3 px-2 font-medium">Instagram</th>
                        <th className="text-center py-3 px-2 font-medium">YouTube</th>
                        <th className="text-center py-3 px-2 font-medium">X</th>
                        <th className="text-center py-3 px-2 font-medium">Snapchat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureComparison.map((row, index) => (
                        <tr key={index} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="py-3 px-2 text-sm">{row.feature}</td>
                          <td className="text-center py-3 px-2">
                            {row.feedin ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                          <td className="text-center py-3 px-2">
                            {row.tiktok ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                          <td className="text-center py-3 px-2">
                            {row.instagram ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                          <td className="text-center py-3 px-2">
                            {row.youtube ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                          <td className="text-center py-3 px-2">
                            {row.twitter ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                          <td className="text-center py-3 px-2">
                            {row.snapchat ? (
                              <Check className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-secondary/50">
                  <h4 className="font-semibold mb-2">Key Takeaways</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>FeedIn is the only platform with built-in AI tools and credit economy</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>P2P marketplace feature unique to FeedIn</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>No follower thresholds for monetization—completely unique in the market</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Full feature set combining the best of all major platforms in one app</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="pt-6 text-center space-y-4">
            <h4 className="text-2xl font-bold">Ready to Learn More?</h4>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Interested in investing in the future of creator monetization? 
              View our full investor information or get in touch with our team.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/investors')}>
                View Investor Info
              </Button>
              <Button variant="outline" onClick={() => window.open('mailto:invest@feedin.app', '_blank')}>
                Contact Us
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompetitiveAnalysis;
