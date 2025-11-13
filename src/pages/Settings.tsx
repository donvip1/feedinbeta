import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { BottomNav } from '@/components/navigation/BottomNav';
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
  Layers,
  Crown,
  Bookmark,
  HardDrive
} from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  const settingsOptions = [
    {
      icon: User,
      title: 'Account Settings',
      description: 'Edit profile, username, and email',
      route: '/settings/account',
      color: 'text-blue-500'
    },
    {
      icon: Shield,
      title: 'Privacy Settings',
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
      icon: Lock,
      title: 'Blocked Users',
      description: 'Manage blocked and muted accounts',
      route: '/settings/blocked',
      color: 'text-red-500'
    },
    {
      icon: HardDrive,
      title: 'Cache & Storage',
      description: 'Manage app cache and cookies',
      route: '/settings/cache',
      color: 'text-cyan-500'
    }
  ];

  const contentOptions = [
    {
      icon: TrendingUp,
      title: 'Trending',
      description: 'Discover trending posts and hashtags',
      route: '/trending',
      color: 'text-orange-500'
    },
    {
      icon: UsersRound,
      title: 'Groups',
      description: 'Join and manage community groups',
      route: '/groups',
      color: 'text-green-500'
    },
    {
      icon: Bookmark,
      title: 'Saved Posts',
      description: 'View your bookmarked content',
      route: '/saved',
      color: 'text-blue-500'
    }
  ];

  const walletOptions = [
    {
      icon: Wallet,
      title: 'Wallet & Credit',
      description: 'Balance, credits, subscriptions & transactions',
      route: '/wallet',
      color: 'text-yellow-500'
    },
    {
      icon: Layers,
      title: 'P2P Marketplace',
      description: 'Trade credits with other users',
      route: '/p2p-marketplace',
      color: 'text-cyan-500'
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate(`/profile/${user.id}`)}
                size="sm"
                variant="ghost"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <img src={feedinLogo} alt="FEEDIN" className="w-8 h-8" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Settings
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Card className="bg-card border-border">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-2 text-foreground">Settings</h2>
            <p className="text-muted-foreground mb-6">
              Manage your account and preferences
            </p>

            <div className="space-y-2">
              {settingsOptions.map((option, index) => (
                <div key={option.route}>
                  <button
                    onClick={() => navigate(option.route)}
                    className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`${option.color}`}>
                        <option.icon className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-foreground">{option.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                  {index < settingsOptions.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <h3 className="text-lg font-semibold mb-4 text-foreground">Content & Discovery</h3>
            <div className="space-y-2">
              {contentOptions.map((option) => (
                <button
                  key={option.route}
                  onClick={() => navigate(option.route)}
                  className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`${option.color}`}>
                      <option.icon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">{option.title}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>

            <Separator className="my-6" />

            <h3 className="text-lg font-semibold mb-4 text-foreground">Wallet & Credits</h3>
            <div className="space-y-2">
              {walletOptions.map((option) => (
                <button
                  key={option.route}
                  onClick={() => navigate(option.route)}
                  className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`${option.color}`}>
                      <option.icon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">{option.title}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-card border-border mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-destructive">
              Danger Zone
            </h3>
            <Button
              onClick={() => navigate('/settings/account')}
              variant="outline"
              className="w-full justify-between border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              <div className="flex items-center space-x-2">
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Sign Out */}
        <Card className="bg-card border-border mt-6">
          <div className="p-6">
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full justify-center border-border"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Settings;
