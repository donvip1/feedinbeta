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
      generateInvestmentPDF();
      toast({
        title: "PDF Downloaded",
        description: "Investment Memorandum has been saved to your downloads folder.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const platformMetrics = [
    { label: 'Monthly Active Users', value: '50K+', growth: '+340% YoY', icon: Users },
    { label: 'Daily Posts Created', value: '10K+', growth: '+280% YoY', icon: BarChart3 },
    { label: 'Countries Reached', value: '25+', growth: 'Expanding', icon: Globe },
    { label: 'Credits Transacted', value: '1M+', growth: '+450% YoY', icon: Coins },
    { label: 'Live Streams Hosted', value: '5K+', growth: '+520% YoY', icon: Video },
    { label: 'Messages Sent Daily', value: '100K+', growth: '+380% YoY', icon: MessageCircle },
  ];

  const capTable = [
    { holder: 'Founders (CEO & Co-Founder)', percentage: 50, description: 'Vested over 4 years with 1-year cliff' },
    { holder: 'Series Seed Investors', percentage: 20, description: 'Current funding round allocation' },
    { holder: 'ESOP (Employee Stock Option Pool)', percentage: 15, description: 'Reserved for key hires and team expansion' },
    { holder: 'Advisors & Strategic Partners', percentage: 10, description: 'Industry experts and growth partners' },
    { holder: 'Future Rounds Reserve', percentage: 5, description: 'Reserved for Series A and beyond' },
  ];

  const useOfFunds = [
    { category: 'Product Development', percentage: 35, amount: '$350K', description: 'AI features, streaming infrastructure, mobile apps' },
    { category: 'User Acquisition', percentage: 25, amount: '$250K', description: 'Marketing, influencer partnerships, growth campaigns' },
    { category: 'Team Expansion', percentage: 20, amount: '$200K', description: 'Engineering, design, community management' },
    { category: 'Infrastructure', percentage: 12, amount: '$120K', description: 'Servers, CDN, security, compliance' },
    { category: 'Operations & Legal', percentage: 8, amount: '$80K', description: 'Legal, accounting, office, misc' },
  ];

  const milestones = [
    { quarter: 'Q1 2026', goal: '100K MAU', status: 'In Progress', details: 'Launch mobile apps, expand AI features' },
    { quarter: 'Q2 2026', goal: '250K MAU', status: 'Planned', details: 'Enter 10 new markets, creator partnerships' },
    { quarter: 'Q3 2026', goal: '500K MAU', status: 'Planned', details: 'Launch premium subscriptions at scale' },
    { quarter: 'Q4 2026', goal: '1M MAU', status: 'Target', details: 'Series A preparation, break-even trajectory' },
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
    { role: 'CTO / Lead Engineer', priority: 'Critical', timeline: 'Q1 2026' },
    { role: 'Head of Growth', priority: 'High', timeline: 'Q1 2026' },
    { role: 'Senior Full-Stack Engineers (2)', priority: 'High', timeline: 'Q1-Q2 2026' },
    { role: 'Mobile Developer (iOS/Android)', priority: 'High', timeline: 'Q2 2026' },
    { role: 'Community Manager', priority: 'Medium', timeline: 'Q2 2026' },
    { role: 'Content & Creator Relations', priority: 'Medium', timeline: 'Q2 2026' },
  ];

  const risks = [
    { risk: 'Market Competition', mitigation: 'Focus on creator-first features that established platforms ignore; rapid iteration' },
    { risk: 'User Acquisition Cost', mitigation: 'Viral referral system with credit incentives; organic creator-driven growth' },
    { risk: 'Regulatory Changes', mitigation: 'Privacy-first architecture; compliance-ready infrastructure; legal counsel' },
    { risk: 'Technology Scaling', mitigation: 'Cloud-native architecture; CDN for global delivery; modular microservices' },
    { risk: 'Creator Retention', mitigation: 'Competitive payout rates (85%+); instant monetization; exclusive features' },
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
              <p className="text-muted-foreground">Confidential • Series Seed • January 2026</p>
            </div>
          </div>
          
          <div className="space-y-4 text-foreground/90">
            <p className="text-lg leading-relaxed">
              <strong>FEEDIN</strong> is a next-generation social media platform that puts creators first. 
              We combine social networking, live streaming, AI-powered tools, and an integrated credit economy 
              to enable creators to monetize their content from day one—no follower thresholds, no waiting periods.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">$1M</div>
                <div className="text-xs text-muted-foreground">Raising</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">$5M</div>
                <div className="text-xs text-muted-foreground">Pre-Money Valuation</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">20%</div>
                <div className="text-xs text-muted-foreground">Equity Offered</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">18 mo</div>
                <div className="text-xs text-muted-foreground">Runway</div>
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

        {/* Platform Metrics */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-500" />
            Traction & Key Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {platformMetrics.map((metric, index) => (
              <div key={index} className="bg-secondary/30 rounded-lg p-4">
                <metric.icon className="w-5 h-5 text-primary mb-2" />
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <div className="text-xs text-green-500 mt-1">{metric.growth}</div>
              </div>
            ))}
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
            Cap Table (Post-Investment)
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
            <h3 className="font-semibold mb-2">Investment Terms</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Instrument:</strong> SAFE (Simple Agreement for Future Equity)</li>
              <li>• <strong>Valuation Cap:</strong> $5M</li>
              <li>• <strong>Discount:</strong> 20% on next priced round</li>
              <li>• <strong>Minimum Investment:</strong> $25,000</li>
              <li>• <strong>Pro-rata Rights:</strong> Yes, for investments ≥$50K</li>
            </ul>
          </div>
        </Card>

        {/* Use of Funds */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Use of Funds ($1M Raise)
          </h2>
          <div className="space-y-4">
            {useOfFunds.map((item, index) => (
              <div key={index} className="bg-secondary/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{item.category}</span>
                  <div className="text-right">
                    <span className="text-primary font-bold">{item.amount}</span>
                    <span className="text-muted-foreground text-sm ml-2">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Milestones */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" />
            2026 Milestones & Roadmap
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
            Team & Key Hires
          </h2>
          
          <div className="mb-6 p-4 bg-primary/10 rounded-lg">
            <h3 className="font-semibold mb-2">Current Team</h3>
            <p className="text-sm text-muted-foreground">
              Founder-led team with full-stack development, product design, and go-to-market experience. 
              Built the entire platform from scratch with a focus on scalability and user experience.
            </p>
          </div>

          <h3 className="font-semibold mb-3">Planned Hires (Post-Funding)</h3>
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
            Risk Factors & Mitigation
          </h2>
          <div className="space-y-4">
            {risks.map((item, index) => (
              <div key={index} className="bg-background/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-destructive">{item.risk}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Mitigation:</strong> {item.mitigation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-background/30 rounded-lg border border-destructive/20">
            <p className="text-sm text-foreground/80">
              <strong>Disclaimer:</strong> This document is for informational purposes only and does not constitute 
              an offer to sell or solicitation to buy securities. All investments carry risk and past performance 
              does not guarantee future results. Prospective investors should conduct their own due diligence and 
              consult with financial, legal, and tax advisors before making any investment decision.
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
                  <span>Schedule an intro call with our founding team</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Receive detailed financial projections and data room access</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Complete due diligence and legal review</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Sign SAFE agreement and wire funds</span>
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
