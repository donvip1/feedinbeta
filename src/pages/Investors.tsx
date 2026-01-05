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
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const Investors = () => {
  const navigate = useNavigate();

  const metrics = [
    { label: 'Active Users', value: '50K+', icon: Users, color: 'text-blue-500' },
    { label: 'Daily Posts', value: '10K+', icon: BarChart3, color: 'text-green-500' },
    { label: 'Countries', value: '25+', icon: Globe, color: 'text-purple-500' },
    { label: 'Credits Transacted', value: '1M+', icon: Coins, color: 'text-yellow-500' },
  ];

  const investorFAQ = [
    {
      question: 'What is FEEDIN?',
      answer: 'FEEDIN is a next-generation social media platform combining content creation, live streaming, AI-powered tools, and an integrated credit economy. We enable creators to monetize their content directly.',
    },
    {
      question: 'What is the revenue model?',
      answer: 'Revenue comes from credit purchases, premium subscriptions, platform fees on gifts/transactions, promoted content, and AI feature usage. Our credit system creates a sustainable economy.',
    },
    {
      question: 'How does the credit economy work?',
      answer: 'Users purchase credits that can be used for promotions, gifts, AI features, and premium content. Creators earn credits from gifts and can request payouts. Platform takes a small percentage.',
    },
    {
      question: 'What makes FEEDIN different?',
      answer: 'We integrate social media, education (Learn Tech), AI tools, and monetization into one platform. Our focus on creator empowerment and integrated credit economy sets us apart.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <img src={feedinLogo} alt="FEEDIN" className="w-8 h-8" />
            <span className="text-xl font-bold">For Investors</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        {/* Hero Section */}
        <Card className="bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Investor Relations</h1>
              <p className="text-muted-foreground">Building the future of social media</p>
            </div>
          </div>
          <p className="text-foreground/80 mb-4">
            FEEDIN is revolutionizing how creators connect with audiences through integrated AI tools, 
            live streaming, and a sustainable credit economy that empowers content creators.
          </p>
        </Card>

        {/* Key Metrics */}
        <Card className="bg-card border-border p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Platform Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric, index) => (
              <div key={index} className="bg-secondary/30 rounded-lg p-4 text-center">
                <metric.icon className={`w-6 h-6 mx-auto mb-2 ${metric.color}`} />
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk Disclosure */}
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/30 p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Risk Disclosure
          </h2>
          <ul className="space-y-3 text-sm text-foreground/80">
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
              <span>All investments carry risk. Past performance does not guarantee future results.</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
              <span>Social media platforms face regulatory, competitive, and market risks.</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
              <span>Technology investments are subject to rapid changes and disruption.</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
              <span>Please consult financial advisors before making investment decisions.</span>
            </li>
          </ul>
        </Card>

        {/* Investor FAQ */}
        <Card className="bg-card border-border p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Investor FAQ
          </h2>
          <div className="space-y-4">
            {investorFAQ.map((item, index) => (
              <div key={index} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Contact & Resources */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-primary" />
            Resources & Contact
          </h2>
          <div className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-between"
              onClick={() => navigate('/settings/investment-docs')}
            >
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                View Investment Memorandum
              </span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate('/admin/analytics')}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                View Analytics Dashboard
              </span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate('/settings/help')}
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Contact Support
              </span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground text-center">
              For investor inquiries: <span className="text-primary">investors@feedin.app</span>
            </p>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Investors;