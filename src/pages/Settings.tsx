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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/50 backdrop-blur-lg border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate(`/profile/${user.id}`)}
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
        {/* Main Settings Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 text-foreground">Settings</h2>
              <p className="text-muted-foreground">
                Manage your account and preferences
              </p>
            </div>

            <div className="space-y-1">
              {settingsOptions.map((option, index) => (
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
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {option.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </button>
                  {index < settingsOptions.length - 1 && (
                    <Separator className="my-1 bg-border/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Content & Discovery Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Content & Discovery
            </h3>
            <div className="space-y-1">
              {contentOptions.map((option) => (
                <button
                  key={option.route}
                  onClick={() => navigate(option.route)}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gradient-to-r hover:from-secondary/50 hover:to-accent/20 transition-all duration-300 group border border-transparent hover:border-border/50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`${option.color} bg-gradient-to-br from-secondary/40 to-secondary/20 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {option.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Wallet & Credits Card */}
        <Card className="bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm border-border shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-yellow-500" />
              Wallet & Credits
            </h3>
            <div className="space-y-1">
              {walletOptions.map((option) => (
                <button
                  key={option.route}
                  onClick={() => navigate(option.route)}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gradient-to-r hover:from-secondary/50 hover:to-accent/20 transition-all duration-300 group border border-transparent hover:border-border/50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`${option.color} bg-gradient-to-br from-secondary/40 to-secondary/20 p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {option.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm border-destructive/30 shadow-xl mt-6">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4 text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h3>
            <Button
              onClick={() => navigate('/settings/account')}
              variant="outline"
              className="w-full justify-between border-destructive/50 text-destructive hover:bg-destructive/20 hover:border-destructive transition-all duration-300 group"
            >
              <div className="flex items-center space-x-2">
                <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Delete Account</span>
              </div>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </Card>

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
