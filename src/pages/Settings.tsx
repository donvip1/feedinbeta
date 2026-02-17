import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useTheme } from 'next-themes';
import { ReferralSection } from '@/components/settings/ReferralSection';
import { 
  ArrowLeft, 
  User, 
  Shield, 
  Bell, 
  Lock, 
  Trash2,
  ChevronRight,
  LogOut,
  TrendingUp,
  UsersRound,
  Wallet,
  Coins,
  Crown,
  Bookmark,
  HardDrive,
  Globe,
  HelpCircle,
  Users,
  Radio,
  ShieldCheck,
  Briefcase,
  Smartphone,
  Banknote,
  Moon,
  Sun,
  BarChart3,
  Gift,
  Rocket
} from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { theme, setTheme } = useTheme();

  // Fetch user profile with caching
  const { data: userProfile } = useCachedQuery({
    cacheKey: `profile:${user?.id}`,
    queryKey: ["user-profile-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user?.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
    ttl: 30 * 60 * 1000, // 30 minutes
  });

  // Server-side check for admin wallet access with caching
  const { data: canViewAdminWallet } = useCachedQuery({
    cacheKey: `admin_access:${user?.id}`,
    queryKey: ["can-view-admin-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_admin_wallet");
      if (error) return false;
      return data as boolean;
    },
    enabled: !!user,
    ttl: 30 * 60 * 1000, // 30 minutes
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  const accountOptions = [
    {
      icon: User,
      title: 'Account Settings',
      description: 'Edit profile, username, and email',
      route: '/settings/account',
      color: 'text-blue-500'
    },
    {
      icon: Shield,
      title: 'Privacy & Security',
      description: 'Control who can see your content',
      route: '/settings/privacy',
      color: 'text-purple-500'
    },
    {
      icon: Bell,
      title: 'Notifications',
      description: 'Manage notification preferences',
      route: '/settings/notifications',
      color: 'text-pink-500'
    },
    {
      icon: Smartphone,
      title: 'Session Management',
      description: 'View and manage active sessions',
      route: '/settings/sessions',
      color: 'text-cyan-500'
    },
    {
      icon: Lock,
      title: 'Blocked Users',
      description: 'Manage blocked and muted accounts',
      route: '/settings/blocked',
      color: 'text-red-500'
    },
    {
      icon: Globe,
      title: 'Language',
      description: 'Choose your preferred language',
      route: '/settings/language',
      color: 'text-teal-500'
    },
    {
      icon: Wallet,
      title: 'Currency & Location',
      description: 'Set your preferred currency',
      route: '/settings/currency',
      color: 'text-emerald-500'
    }
  ];

  const walletOptions = [
    {
      icon: Wallet,
      title: 'Wallet & Credits',
      description: 'View balance, buy and send credits',
      route: '/wallet',
      color: 'text-green-500'
    },
    {
      icon: Crown,
      title: 'Subscription Plans',
      description: 'Upgrade to premium features',
      route: '/wallet/subscription',
      color: 'text-yellow-500'
    },
    {
      icon: Coins,
      title: 'Buy Credits',
      description: 'Purchase credit packages',
      route: '/wallet/credits',
      color: 'text-amber-500'
    },
    {
      icon: TrendingUp,
      title: 'P2P Marketplace',
      description: 'Buy and sell credits peer-to-peer',
      route: '/wallet/p2p',
      color: 'text-blue-500'
    },
    {
      icon: Banknote,
      title: 'P2P Payment Methods',
      description: 'Manage your bank accounts for P2P trading',
      route: '/p2p/payment-methods',
      color: 'text-cyan-500'
    }
  ];

  const socialOptions = [
    {
      icon: Users,
      title: 'Friends',
      description: 'Manage friends and requests',
      route: '/friends',
      color: 'text-blue-500'
    },
    {
      icon: UsersRound,
      title: 'Groups',
      description: 'Your communities and groups',
      route: '/groups',
      color: 'text-indigo-500'
    },
    {
      icon: Bookmark,
      title: 'Saved Posts',
      description: 'View your saved content',
      route: '/saved',
      color: 'text-orange-500'
    },
    {
      icon: Radio,
      title: 'Live Streaming',
      description: 'Go live and watch streams',
      route: '/live',
      color: 'text-red-500'
    }
  ];

  const contentOptions = [
    {
      icon: Rocket,
      title: 'Manage Ads',
      description: 'Create and track your ad campaigns',
      route: '/ads/my-ads',
      color: 'text-amber-500'
    },
    {
      icon: TrendingUp,
      title: 'Trending',
      description: 'Discover trending posts and hashtags',
      route: '/feed/trending',
      color: 'text-orange-500'
    },
    {
      icon: BarChart3,
      title: 'Creator Dashboard',
      description: 'View your analytics and earnings',
      route: '/creator/dashboard',
      color: 'text-emerald-500'
    }
  ];

  const adminOptions = [
    {
      icon: Shield,
      title: 'Admin Panel',
      description: 'Manage P2P orders, disputes, and roles',
      route: '/admin/panel',
      color: 'text-primary'
    },
    {
      icon: ShieldCheck,
      title: 'FeedIn Wallet',
      description: 'Platform wallet and credit management',
      route: '/wallet/admin',
      color: 'text-emerald-500'
    },
    {
      icon: Banknote,
      title: 'Creator Payouts',
      description: 'Manage creator monetization and payouts',
      route: '/wallet/creator-payouts',
      color: 'text-green-500'
    },
    {
      icon: TrendingUp,
      title: 'Analytics Dashboard',
      description: 'MAU, DAU, revenue, and investor metrics',
      route: '/admin/analytics',
      color: 'text-blue-500'
    },
    {
      icon: Trash2,
      title: 'Deleted Posts Recovery',
      description: 'Search and restore user deleted posts',
      route: '/admin/deleted-posts',
      color: 'text-red-500'
    }
  ];

  const supportOptions = [
    {
      icon: HelpCircle,
      title: 'Help & Support',
      description: 'FAQ, contact support, report issues',
      route: '/settings/help',
      color: 'text-cyan-500'
    },
    {
      icon: HardDrive,
      title: 'Cache & Storage',
      description: 'Manage app cache and cookies',
      route: '/settings/cache',
      color: 'text-slate-500'
    },
    {
      icon: Briefcase,
      title: 'For Investors',
      description: 'Risk disclosure and investor FAQ',
      route: '/settings/investors',
      color: 'text-emerald-500'
    }
  ];

  const renderOptionsList = (options: typeof accountOptions) => (
    <div className="space-y-1">
      {options.map((option, index) => (
        <div key={option.route}>
          <button
            onClick={() => navigate(option.route)}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gradient-to-r hover:from-secondary/50 hover:to-accent/20 transition-all duration-300 group border border-transparent hover:border-border/50"
          >
            <div className="flex items-center space-x-4">
              <div className={`${option.color} bg-gradient-to-br from-secondary/40 to-secondary/20 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <option.icon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className={`font-semibold ${option.color} transition-colors`}>
                  {option.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 ${option.color} group-hover:translate-x-1 transition-all`} />
          </button>
          {index < options.length - 1 && (
            <Separator className="my-1 bg-border/30" />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/50 backdrop-blur-lg border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate(`/profile/${userProfile?.username || user?.id}`)}
                size="sm"
                variant="ghost"
                className="hover:bg-secondary"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </Button>
              <img src={feedinLogo} alt="FEEDIN" className="w-10 h-10" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Settings
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        {/* Theme Toggle Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-yellow-500 bg-gradient-to-br from-secondary/40 to-secondary/20 p-3 rounded-xl shadow-md">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Dark Mode</h3>
                  <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </div>
        </Card>

        {/* Referral Section */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm border-primary/30 shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Invite Friends
            </h3>
            <ReferralSection />
          </div>
        </Card>

        {/* Account Settings Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Account & Privacy
              </h2>
            </div>
            {renderOptionsList(accountOptions)}
          </div>
        </Card>

        {/* Wallet & Subscription Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-500" />
              Wallet & Subscription
            </h3>
            {renderOptionsList(walletOptions)}
          </div>
        </Card>

        {/* Social & Content Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Social & Content
            </h3>
            {renderOptionsList(socialOptions)}
          </div>
        </Card>

        {/* Content & Discovery Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Discover
            </h3>
            {renderOptionsList(contentOptions)}
          </div>
        </Card>

        {/* Support & Storage Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-500" />
              Support & Storage
            </h3>
            {renderOptionsList(supportOptions)}
          </div>
        </Card>

        {/* Admin Section - Only visible to admins/moderators */}
        {canViewAdminWallet && (
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-sm border-emerald-500/30 shadow-xl mt-6">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 text-emerald-500 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Administration
              </h3>
              {renderOptionsList(adminOptions)}
            </div>
          </Card>
        )}

        {/* Note: Danger Zone moved to Privacy & Security settings */}

        {/* Sign Out */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full justify-center border-border text-foreground hover:bg-secondary/50 hover:border-primary/50 transition-all duration-300 group"
            >
              <LogOut className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">Sign Out</span>
            </Button>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Settings;
