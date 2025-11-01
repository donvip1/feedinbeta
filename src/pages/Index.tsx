import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageCircle, TrendingUp, Users, Zap, LogOut } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <div className="animate-pulse">
          <img src={feedinLogo} alt="FEEDIN" className="w-20 h-20" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        {/* Hero Section */}
        <header className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={feedinLogo} alt="FEEDIN" className="w-12 h-12" />
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                FEEDIN
              </span>
            </div>
            <Button
              onClick={() => navigate('/auth')}
              className="bg-gradient-primary hover:shadow-glow"
            >
              Get Started
            </Button>
          </nav>
        </header>

        <main className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              AI-Powered Social Media Intelligence
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Track conversations, analyze trends, and gain powerful insights from social media
              with cutting-edge AI monitoring and analytics.
            </p>
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-gradient-primary hover:shadow-glow text-lg px-8 py-6"
            >
              Start Free Trial
            </Button>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
            <div className="p-6 rounded-lg bg-card border border-border shadow-elegant hover:shadow-glow transition-all">
              <MessageCircle className="w-12 h-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
              <p className="text-muted-foreground">
                Track mentions, keywords, and conversations across all major social platforms
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border border-border shadow-elegant hover:shadow-glow transition-all">
              <TrendingUp className="w-12 h-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Trend Analysis</h3>
              <p className="text-muted-foreground">
                Identify emerging trends and viral content before they peak
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border border-border shadow-elegant hover:shadow-glow transition-all">
              <Users className="w-12 h-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Audience Insights</h3>
              <p className="text-muted-foreground">
                Understand your audience demographics, behaviors, and preferences
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border border-border shadow-elegant hover:shadow-glow transition-all">
              <Zap className="w-12 h-12 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">AI-Powered</h3>
              <p className="text-muted-foreground">
                Leverage advanced AI to automate analysis and generate actionable insights
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="container mx-auto px-4 py-6 border-b border-border">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={feedinLogo} alt="FEEDIN" className="w-12 h-12" />
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              FEEDIN
            </span>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto animate-fade-in">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Welcome to FEEDIN Dashboard
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Your social media intelligence platform is ready. Start tracking conversations and
            analyzing trends.
          </p>
          <div className="p-8 rounded-lg bg-card border border-border shadow-elegant">
            <p className="text-muted-foreground">
              Dashboard features coming in Phase 2...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
