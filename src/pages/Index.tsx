import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Coins, Zap, Users, Gift, Globe, TrendingUp } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';
import { useEffect, useState } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      setIsRedirecting(true);
      navigate('/feed', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || isRedirecting || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse">
          <img src={feedinLogo} alt="feedin" className="w-40 h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in">
          <div className="flex justify-center mb-6">
            <img src={feedinLogo} alt="feedin" className="w-48 h-48" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
            Start Earning Today
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            No followers needed. No payment restrictions. No waiting.
          </p>
          <p className="text-gray-500">
            Go live, get gifted, cash out — from anywhere in the world.
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
          <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <Zap className="w-12 h-12 mb-4 text-pink-500 stroke-[2]" />
            <h3 className="text-2xl font-bold text-black mb-3">Go Live, Get Paid</h3>
            <p className="text-gray-600">
              Start streaming instantly. Viewers send gifts and you earn 85% — no minimums, no delays.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <Coins className="w-12 h-12 mb-4 text-purple-500 stroke-[2]" />
            <h3 className="text-2xl font-bold text-black mb-3">Earn & Cash Out</h3>
            <p className="text-gray-600">
              No geographic restrictions. No high withdrawal fees. Trade credits and cash out your way.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <Users className="w-12 h-12 mb-4 text-cyan-500 stroke-[2]" />
            <h3 className="text-2xl font-bold text-black mb-3">Build Your Community</h3>
            <p className="text-gray-600">
              Create fan groups, host audio spaces, and grow your audience with zero algorithm bias.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <Gift className="w-12 h-12 mb-4 text-pink-500 stroke-[2]" />
            <h3 className="text-2xl font-bold text-black mb-3">10 Free Credits</h3>
            <p className="text-gray-600">
              Every new creator gets 10 free credits on signup. Start gifting, trading, or going live immediately.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <Globe className="w-12 h-12 mb-4 text-purple-500 stroke-[2]" />
            <h3 className="text-2xl font-bold text-black mb-3">No Barriers</h3>
            <p className="text-gray-600">
              Works everywhere. No country restrictions, no payment gatekeeping, no verification hassle.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <TrendingUp className="w-12 h-12 mb-4 text-cyan-500 stroke-[2]" />
            <h3 className="text-2xl font-bold text-black mb-3">Grow & Earn More</h3>
            <p className="text-gray-600">
              Creator leaderboards, regional discovery, and smart tools to boost your earnings over time.
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
            Start Earning Today
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

        {/* Social Proof */}
        <p className="text-center text-gray-400 text-sm mb-4">
          🎁 10 free credits on signup · 💰 85% earnings on gifts · 🌍 No country restrictions
        </p>

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
};

export default Index;
