import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, 
  Briefcase, 
  TrendingUp, 
  Shield, 
  AlertTriangle,
  Users,
  Globe,
  Coins,
  BarChart3,
  Target,
  Rocket,
  PieChart,
  DollarSign,
  Calendar,
  CheckCircle2,
  Building2,
  Sparkles,
  Video,
  MessageCircle,
  Zap,
  Lock,
  Award,
  FileText,
  Mail,
  Download,
  Loader2
} from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';
import { generateInvestmentPDF } from '@/lib/generate-investment-pdf';
import { useToast } from '@/hooks/use-toast';

const InvestmentDocs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      console.log('Starting PDF generation...');
      generateInvestmentPDF();
      console.log('PDF generation completed successfully');
      toast({
        title: "PDF Downloaded",
        description: "Investment Memorandum has been saved to your downloads folder.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const developmentProgress = [
    { label: 'App Completion', value: '40%', status: 'In Development', icon: BarChart3 },
    { label: 'MVP Budget', value: '$15K', status: 'Total Cost', icon: Coins },
    { label: 'Already Spent', value: '$4K+', status: 'Invested', icon: DollarSign },
    { label: 'Still Needed', value: '~$11K', status: 'To Complete', icon: Target },
    { label: 'Development Time', value: '4 Months', status: 'Since Sep 2025', icon: Calendar },
    { label: 'Target Launch', value: 'Q1 2026', status: 'March 2026', icon: Rocket },
  ];

  const capTable = [
    { holder: 'Founders (CEO & Co-Founder)', percentage: 50, description: 'The team who built the app and runs it daily' },
    { holder: 'Investors (You)', percentage: 20, description: 'What we are offering in this round' },
    { holder: 'Future Employees', percentage: 15, description: 'Saved for people we hire later' },
    { holder: 'Advisors', percentage: 10, description: 'Experts who guide us' },
    { holder: 'Future Investors', percentage: 5, description: 'Saved for bigger investments later' },
  ];

  const useOfFunds = [
    { category: 'Servers & Hosting', percentage: 20, amount: '$3,000', spent: '$1,200', description: 'Cloud infrastructure to run the app' },
    { category: 'AI Services', percentage: 17, amount: '$2,500', spent: '$800', description: 'AI features for chat and image creation' },
    { category: 'Live Streaming Tech', percentage: 20, amount: '$3,000', spent: '$600', description: 'Go live and receive gifts in real-time' },
    { category: 'Video Calling Tech', percentage: 13, amount: '$2,000', spent: '$300', description: 'Voice and video calls between users' },
    { category: 'Software & Tools', percentage: 10, amount: '$1,500', spent: '$500', description: 'Development tools and licenses' },
    { category: 'Design & Images', percentage: 7, amount: '$1,000', spent: '$400', description: 'UI design and graphics' },
    { category: 'Testing & Launch', percentage: 13, amount: '$2,000', spent: '$200', description: 'Testing and marketing at launch' },
  ];

  const milestones = [
    { quarter: 'Jan 2026', goal: 'Finish Live Streaming', status: 'In Progress', details: 'Creators can go live and receive gifts' },
    { quarter: 'Feb 2026', goal: 'Add Voice/Video Calls', status: 'Planned', details: 'Users can call each other directly' },
    { quarter: 'Feb 2026', goal: 'Build Learn AI Section', status: 'Planned', details: 'Tech education content for users' },
    { quarter: 'Mar 2026', goal: 'LAUNCH THE APP', status: 'Target', details: 'Open to everyone, start marketing' },
    { quarter: 'Q2 2026', goal: 'Get 1,000 Users', status: 'Goal', details: 'Invite creators, build community' },
    { quarter: 'Q3-Q4 2026', goal: 'Get 5,000+ Users', status: 'Goal', details: 'Start making profit, grow bigger' },
  ];

  const revenueStreams = [
    { stream: 'Credit Purchases', percentage: 40, description: 'Users buy credits for gifts, promotions, AI features' },
    { stream: 'Premium Subscriptions', percentage: 25, description: 'Monthly/annual premium memberships with exclusive features' },
    { stream: 'Platform Transaction Fees', percentage: 20, description: '10-15% fee on gifts, P2P trades, and creator payouts' },
    { stream: 'Promoted Content', percentage: 10, description: 'Creators pay to boost visibility of their posts' },
    { stream: 'Enterprise & API Access', percentage: 5, description: 'B2B integrations and white-label solutions' },
  ];

  const competitiveAdvantages = [
    { title: 'Instant Creator Monetization', description: 'No follower thresholds - creators earn from day one through our credit system', icon: DollarSign },
    { title: 'Integrated AI Suite', description: 'Built-in AI tools for content creation, image generation, and smart assistance', icon: Sparkles },
    { title: 'Unified Experience', description: 'Social feed, live streaming, messaging, and monetization in one platform', icon: Zap },
    { title: 'Credit Economy', description: 'Proprietary virtual currency creates engagement loops and revenue predictability', icon: Coins },
    { title: 'Low-Latency Live Streaming', description: 'WebRTC-based streaming with gifts, reactions, and real-time interaction', icon: Video },
    { title: 'Privacy-First Architecture', description: 'Row-level security, encrypted messaging, and user data protection', icon: Lock },
  ];

  const teamRequirements = [
    { role: 'Another Developer', priority: 'High', timeline: 'After Launch' },
    { role: 'Community Manager', priority: 'Medium', timeline: 'After Launch' },
  ];

  const risks = [
    { risk: 'We are just starting out', mitigation: 'We already built 40% of the app; you can try it yourself before investing' },
    { risk: 'Big companies like Instagram exist', mitigation: 'We focus on helping small creators who they ignore' },
    { risk: 'Getting users is hard', mitigation: 'We give free credits to attract people; creators invite their fans' },
    { risk: 'App might slow down with many users', mitigation: 'We built it to handle growth from the start' },
    { risk: 'Might take time to make money', mitigation: 'We have many ways to earn money and we spend carefully' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <img src={feedinLogo} alt="FEEDIN" className="w-8 h-8" />
              <span className="text-xl font-bold">Investment Memorandum</span>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl pb-24 space-y-8">
        
        {/* Executive Summary */}
        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 border-primary/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/20">
              <Briefcase className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">FEEDIN Investment Memorandum</h1>
              <p className="text-muted-foreground">Confidential • Pre-Seed / MVP Stage • January 2026</p>
            </div>
          </div>
          
          <div className="space-y-4 text-foreground/90">
            <p className="text-lg leading-relaxed">
              <strong>FEEDIN</strong> is a social media app that helps content creators make money from day one. 
              Unlike Instagram or TikTok where you need thousands of followers before you can earn,
              FEEDIN lets anyone receive tips and gifts immediately.
            </p>
            <p className="leading-relaxed">
              Think of it as: <strong>Instagram + TikTok + Patreon, all in one app.</strong>
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">$15K</div>
                <div className="text-xs text-muted-foreground">MVP Budget</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">$4K+</div>
                <div className="text-xs text-muted-foreground">Already Spent</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">~$11K</div>
                <div className="text-xs text-muted-foreground">Still Needed</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">40%</div>
                <div className="text-xs text-muted-foreground">Built So Far</div>
              </div>
            </div>
          </div>
        </Card>

        {/* The Problem & Solution */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            The Problem We Solve
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                For Creators
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  <span>Monetization gatekept behind arbitrary follower thresholds (1K, 10K, 100K)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  <span>Opaque algorithms that suppress reach unless you pay for ads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  <span>Platform takes 30-50% of creator earnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  <span>No direct relationship with audience; platform owns the connection</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Our Solution
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Instant monetization through credit-based gifts and tips from day one</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Transparent feed algorithms with paid promotion as an option, not requirement</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Creators keep 85%+ of earnings; competitive with best-in-class platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>Direct messaging, calls, and live interaction with followers</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Development Progress */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-500" />
            Development Progress
          </h2>
          <p className="text-muted-foreground mb-4">
            We started building FEEDIN about 4 months ago (September 2025). So far, we have spent over $4,000 and built about 40% of the app.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {developmentProgress.map((item, index) => (
              <div key={index} className="bg-secondary/30 rounded-lg p-4">
                <item.icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-2xl font-bold">{item.value}</div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
                <div className="text-xs text-primary mt-1">{item.status}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-green-500 mb-2">✓ What's Already Built (40%)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Social feed - Posts, photos, videos, likes, comments</li>
                <li>• User profiles - Accounts, followers, following</li>
                <li>• Private messaging - Real-time chats</li>
                <li>• Credits system - Buy credits, send gifts</li>
                <li>• AI tools - Chat assistant, image creation</li>
                <li>• Groups & search - Community features</li>
              </ul>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-500 mb-2">⏳ Still Need to Build (60%)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Live streaming - Go live and receive gifts</li>
                <li>• Voice and video calls - Talk with followers</li>
                <li>• Learn AI section - Tech education content</li>
                <li>• Final testing and polish before launch</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Competitive Advantages */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Competitive Advantages
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {competitiveAdvantages.map((advantage, index) => (
              <div key={index} className="bg-secondary/20 rounded-lg p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <advantage.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{advantage.title}</h3>
                  <p className="text-sm text-muted-foreground">{advantage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Revenue Model */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-500" />
            Revenue Streams
          </h2>
          <div className="space-y-4">
            {revenueStreams.map((stream, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stream.stream}</span>
                  <span className="text-primary font-bold">{stream.percentage}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${stream.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{stream.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Cap Table */}
        <Card className="bg-gradient-to-br from-accent/10 to-primary/5 border-primary/20 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-primary" />
            Who Owns What (After Investment)
          </h2>
          <div className="space-y-3">
            {capTable.map((row, index) => (
              <div key={index} className="bg-background/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{row.holder}</span>
                  <span className="text-xl font-bold text-primary">{row.percentage}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    style={{ width: `${row.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{row.description}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-background/30 rounded-lg border border-primary/20">
            <h3 className="font-semibold mb-2">How You Can Invest</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>We want to raise:</strong> $15,000 or more</li>
              <li>• <strong>Smallest investment:</strong> $1,000</li>
              <li>• <strong>What you get:</strong> 20% of the company (if we raise the full $15K)</li>
              <li>• <strong>How we value FEEDIN:</strong> $75,000</li>
            </ul>
            <div className="mt-4 text-sm">
              <p className="font-medium mb-2">Investment Options:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• <strong>$1,000 - $4,999:</strong> 2-5% ownership + updates + early access</li>
                <li>• <strong>$5,000 - $9,999:</strong> 6-10% ownership + help guide the product</li>
                <li>• <strong>$10,000 - $15,000:</strong> 12-20% ownership + become a key partner</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Use of Funds */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Where The Money Goes ($15K Total Budget)
          </h2>
          <div className="space-y-4">
            {useOfFunds.map((item, index) => (
              <div key={index} className="bg-secondary/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{item.category}</span>
                  <div className="text-right">
                    <span className="text-primary font-bold">{item.amount}</span>
                    <span className="text-muted-foreground text-sm ml-2">(spent: {item.spent})</span>
                  </div>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${item.percentage * 5}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm">
              <strong>Total spent so far:</strong> $4,000+ | <strong>Still needed:</strong> ~$11,000
            </p>
          </div>
        </Card>

        {/* Milestones */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" />
            Our Plan for 2026
          </h2>
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-secondary/20 rounded-lg">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{milestone.quarter}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      milestone.status === 'In Progress' 
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : milestone.status === 'Planned'
                        ? 'bg-blue-500/20 text-blue-500'
                        : milestone.status === 'Goal'
                        ? 'bg-purple-500/20 text-purple-500'
                        : 'bg-green-500/20 text-green-500'
                    }`}>
                      {milestone.status}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-primary">{milestone.goal}</div>
                  <p className="text-sm text-muted-foreground">{milestone.details}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Team */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Who We Are
          </h2>
          
          <div className="mb-6 space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <h3 className="font-semibold mb-2">Founder & CEO</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• A web developer who builds apps using modern technology</li>
                <li>• Built the entire FEEDIN app by hand over the past 4 months</li>
                <li>• Cares deeply about helping creators earn money fairly</li>
              </ul>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg">
              <h3 className="font-semibold mb-2">Co-Founder</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Helps with business ideas and planning</li>
                <li>• Works on finding partners and growing the business</li>
              </ul>
            </div>
          </div>

          <h3 className="font-semibold mb-3">People We Plan to Hire (After We Get Funding)</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {teamRequirements.map((hire, index) => (
              <div key={index} className="bg-secondary/20 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{hire.role}</div>
                  <div className="text-xs text-muted-foreground">{hire.timeline}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  hire.priority === 'Critical' 
                    ? 'bg-red-500/20 text-red-500'
                    : hire.priority === 'High'
                    ? 'bg-orange-500/20 text-orange-500'
                    : 'bg-blue-500/20 text-blue-500'
                }`}>
                  {hire.priority}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk Factors */}
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/30 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-destructive">
            <Shield className="w-6 h-6" />
            What Could Go Wrong (And How We Handle It)
          </h2>
          <div className="space-y-4">
            {risks.map((item, index) => (
              <div key={index} className="bg-background/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-destructive">{item.risk}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>How we deal with it:</strong> {item.mitigation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-background/30 rounded-lg border border-destructive/20">
            <p className="text-sm text-foreground/80">
              <strong>Important Note:</strong> All investments carry risk. This document is to give you information 
              about FEEDIN so you can decide if you want to invest. Please talk to a financial advisor before 
              making any investment decision.
            </p>
          </div>
        </Card>

        {/* Contact & Next Steps */}
        <Card className="bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            Next Steps
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Interested in Investing?</h3>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Send us an email to talk about investing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>We'll show you the app and answer your questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Decide how much you want to invest</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Sign agreement and send funds</span>
                </li>
              </ol>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-semibold">Contact Information</h3>
              <div className="bg-background/50 rounded-lg p-4 space-y-2">
                <p className="text-sm">
                  <strong>Investor Relations:</strong><br />
                  <span className="text-primary">investors@feedin.app</span>
                </p>
                <p className="text-sm">
                  <strong>Founding Team:</strong><br />
                  <span className="text-primary">founders@feedin.app</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  We typically respond within 24-48 hours
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="gap-2" onClick={() => navigate('/investors')}>
              <Briefcase className="w-4 h-4" />
              View Investor Relations
            </Button>
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Request Data Room Access
            </Button>
          </div>
        </Card>

      </main>

      <BottomNav />
    </div>
  );
};

export default InvestmentDocs;
