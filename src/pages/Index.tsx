import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users, Phone, Coins, Shield, Sparkles, LogOut } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';
import feedinIcon from '@/assets/feedin-icon.png';
import { useEffect, useState } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Redirect authenticated users to feed immediately
  useEffect(() => {
    if (!loading && user) {
      setIsRedirecting(true);
      navigate('/feed', { replace: true });
    }
  }, [loading, user, navigate]);

  // Show loading spinner while auth state is being determined OR while redirecting
  if (loading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse">
          <img src={feedinLogo} alt="feedin" className="w-48 h-48 object-contain" />
        </div>
      </div>
    );
  }

  // If user exists but hasn't redirected yet, show loading
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="animate-pulse">
          <img src={feedinLogo} alt="feedin" className="w-48 h-48 object-contain" />
        </div>
      </div>
    );
  }

  // Only show sign up/sign in page for unauthenticated users
  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
      <main className="container mx-auto px-4 pt-0 pb-4">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in">
          <div className="flex justify-center mb-4">
            <img src={feedinLogo} alt="feedin" className="w-56 h-56 object-contain" />
          </div>
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
};

export default Index;
