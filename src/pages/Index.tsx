import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users, Phone, Coins, Shield, Sparkles, LogOut } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse">
          <img src={feedinLogo} alt="FEEDIN" className="w-20 h-20" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in">
            <h1 className="text-6xl md:text-7xl font-bold mb-6">
              Welcome to FeedIn
            </h1>
            <p className="text-xl text-gray-400">
              Connect with friends, join groups, and chat with people worldwide
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            {/* Chat & Connect */}
            <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
              <MessageCircle className="w-12 h-12 mb-4 text-pink-500 stroke-[2]" />
              <h3 className="text-2xl font-bold text-black mb-3">Chat & Connect</h3>
              <p className="text-gray-600">
                Send messages, share media, and stay connected with friends
              </p>
            </div>

            {/* Join Groups */}
            <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
              <Users className="w-12 h-12 mb-4 text-purple-500 stroke-[2]" />
              <h3 className="text-2xl font-bold text-black mb-3">Join Groups</h3>
              <p className="text-gray-600">
                Explore groups for games, flirt, romance, advice, and more
              </p>
            </div>

            {/* Voice & Video Calls */}
            <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
              <Phone className="w-12 h-12 mb-4 text-cyan-500 stroke-[2]" />
              <h3 className="text-2xl font-bold text-black mb-3">Voice & Video Calls</h3>
              <p className="text-gray-600">
                Make crystal clear voice and video calls to your friends
              </p>
            </div>

            {/* Credit System */}
            <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
              <Coins className="w-12 h-12 mb-4 text-pink-500 stroke-[2]" />
              <h3 className="text-2xl font-bold text-black mb-3">Credit System</h3>
              <p className="text-gray-600">
                Buy credits, earn daily rewards, and trade with other users
              </p>
            </div>

            {/* Safe & Secure */}
            <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
              <Shield className="w-12 h-12 mb-4 text-purple-500 stroke-[2]" />
              <h3 className="text-2xl font-bold text-black mb-3">Safe & Secure</h3>
              <p className="text-gray-600">
                Auto-moderation keeps the community safe and friendly
              </p>
            </div>

            {/* Premium Features */}
            <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-12 h-12 mb-4 text-cyan-500 stroke-[2]" />
              <h3 className="text-2xl font-bold text-black mb-3">Premium Features</h3>
              <p className="text-gray-600">
                Unlock more friends, groups, and exclusive benefits
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-blue-500 hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] text-white text-lg px-12 py-6 rounded-full font-semibold"
            >
              Get Started
            </Button>
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              variant="outline"
              className="border-2 border-gray-700 bg-transparent hover:bg-gray-900 text-white text-lg px-12 py-6 rounded-full font-semibold"
            >
              Sign In
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-500 text-sm">
            By continuing, you agree to our{' '}
            <span className="text-pink-400 hover:underline cursor-pointer">Terms of Service</span>
            {' '}and{' '}
            <span className="text-pink-400 hover:underline cursor-pointer">Privacy Policy</span>
          </p>
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
