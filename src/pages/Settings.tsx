import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useTheme } from 'next-themes';
import { ReferralSection } from '@/components/settings/ReferralSection';
import { 
  ArrowLeft, User, Shield, Bell, Lock, Trash2, ChevronRight, LogOut,
  TrendingUp, UsersRound, Wallet, Coins, Crown, Bookmark, HardDrive,
  Globe, HelpCircle, Users, Radio, ShieldCheck, Briefcase, Smartphone,
  Download, Banknote, Moon, Sun, BarChart3, Gift, Rocket, Info, FileText,
  Scale, RefreshCw, CheckCircle2, Loader2, ChevronDown, type LucideIcon
} from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';
import { motion, AnimatePresence } from 'framer-motion';

// ── Check for Updates Button ──────────────────────────────────
const CheckForUpdatesButton = () => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'installing'>('idle');

  const checkForUpdates = useCallback(async () => {
    setStatus('checking');
    try {
      if (!('serviceWorker' in navigator)) {
        setStatus('up-to-date');
        setTimeout(() => setStatus('idle'), 4000);
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { 
        setStatus('up-to-date'); 
        setTimeout(() => setStatus('idle'), 4000);
        return; 
      }
      if (reg.waiting) { setStatus('available'); return; }

      const updatePromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);
        const onUpdateFound = () => {
          const newWorker = reg.installing;
          if (!newWorker) { clearTimeout(timeout); resolve(true); return; }
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') { clearTimeout(timeout); resolve(true); }
          });
        };
        reg.addEventListener('updatefound', onUpdateFound, { once: true });
        reg.update().then(() => {
          if (reg.waiting) { clearTimeout(timeout); resolve(true); }
        }).catch(() => { clearTimeout(timeout); resolve(false); });
      });

      const hasUpdate = await updatePromise;
      if (hasUpdate || reg.waiting) { setStatus('available'); }
      else { setStatus('up-to-date'); setTimeout(() => setStatus('idle'), 4000); }
    } catch {
      setStatus('up-to-date');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    setStatus('installing');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        reg.waiting.postMessage({ action: 'skipWaiting' });
        setTimeout(() => window.location.reload(), 3000);
      } else {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        window.location.reload();
      }
    } catch { window.location.reload(); }
  }, []);

  return (
    <button
      onClick={status === 'available' ? applyUpdate : status === 'installing' ? undefined : checkForUpdates}
      disabled={status === 'checking' || status === 'installing'}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-all disabled:opacity-60"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        {status === 'checking' || status === 'installing' ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : status === 'available' ? (
          <Download className="w-4 h-4 text-green-500" />
        ) : status === 'up-to-date' ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <RefreshCw className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-xs font-semibold text-foreground">
          {status === 'checking' ? 'Checking...' :
           status === 'installing' ? 'Installing...' :
           status === 'available' ? 'Update Available' :
           status === 'up-to-date' ? 'Up to date!' :
           'Check for Updates'}
        </p>
      </div>
      {status !== 'installing' && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
};

// ── Types ─────────────────────────────────────────────────────
interface SettingsItem {
  icon: LucideIcon;
  title: string;
  description?: string;
  route: string;
  color: string;
}

interface SettingsGroup {
  id: string;
  icon: LucideIcon;
  label: string;
  iconColor: string;
  items: SettingsItem[];
}

// ── Collapsible Group Component ───────────────────────────────
const SettingsGroupCard = ({ 
  group, 
  isOpen, 
  onToggle, 
  navigate 
}: { 
  group: SettingsGroup; 
  isOpen: boolean; 
  onToggle: () => void; 
  navigate: (route: string) => void;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${group.iconColor} bg-secondary/50 flex items-center justify-center`}>
          <group.icon className="w-4.5 h-4.5" />
        </div>
        <span className="font-semibold text-sm text-foreground">{group.label}</span>
        <span className="text-[10px] text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded-full">
          {group.items.length}
        </span>
      </div>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </motion.div>
    </button>
    
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="px-2 pb-2">
            {group.items.map((item, i) => (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-all group"
              >
                <div className={`w-8 h-8 rounded-lg ${item.color} bg-secondary/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ── Inline Quick Action Row ───────────────────────────────────
const QuickAction = ({ icon: Icon, label, onClick, color }: { icon: LucideIcon; label: string; onClick: () => void; color: string }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 flex-1 py-3 rounded-xl hover:bg-secondary/40 transition-colors">
    <div className={`w-10 h-10 rounded-xl ${color} bg-secondary/50 flex items-center justify-center`}>
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
  </button>
);

// ── Main Settings Page ────────────────────────────────────────
const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['account']));

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
    ttl: 30 * 60 * 1000,
  });

  const { data: canViewAdminWallet } = useCachedQuery({
    cacheKey: `admin_access:${user?.id}`,
    queryKey: ["can-view-admin-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_admin_wallet");
      if (error) return false;
      return data as boolean;
    },
    enabled: !!user,
    ttl: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Group definitions ──
  const groups: SettingsGroup[] = [
    {
      id: 'account',
      icon: User,
      label: 'Account & Privacy',
      iconColor: 'text-blue-500',
      items: [
        { icon: User, title: 'Account Settings', description: 'Profile, username & email', route: '/settings/account', color: 'text-blue-500' },
        { icon: Shield, title: 'Privacy & Security', description: 'Content visibility controls', route: '/settings/privacy', color: 'text-purple-500' },
        { icon: Bell, title: 'Notifications', description: 'Push & in-app alerts', route: '/settings/notifications', color: 'text-pink-500' },
        { icon: Smartphone, title: 'Sessions', description: 'Active device sessions', route: '/settings/sessions', color: 'text-cyan-500' },
        { icon: Lock, title: 'Blocked Users', route: '/settings/blocked', color: 'text-red-500' },
      ],
    },
    {
      id: 'wallet',
      icon: Wallet,
      label: 'Wallet & Finance',
      iconColor: 'text-green-500',
      items: [
        { icon: Wallet, title: 'Wallet & Credits', description: 'Balance, buy & send', route: '/wallet', color: 'text-green-500' },
        { icon: Crown, title: 'Subscription Plans', description: 'Premium features', route: '/wallet/subscription', color: 'text-yellow-500' },
        { icon: Coins, title: 'Buy Credits', route: '/wallet/credits', color: 'text-amber-500' },
        { icon: TrendingUp, title: 'P2P Marketplace', description: 'Peer-to-peer trading', route: '/wallet/p2p', color: 'text-blue-500' },
        { icon: Banknote, title: 'Payment Methods', description: 'Bank accounts for P2P', route: '/p2p/payment-methods', color: 'text-cyan-500' },
      ],
    },
    {
      id: 'social',
      icon: Users,
      label: 'Social & Content',
      iconColor: 'text-indigo-500',
      items: [
        { icon: Users, title: 'Friends', description: 'Friends & requests', route: '/friends', color: 'text-blue-500' },
        { icon: UsersRound, title: 'Groups', description: 'Communities', route: '/groups', color: 'text-indigo-500' },
        
        { icon: Radio, title: 'Live Streaming', route: '/live', color: 'text-red-500' },
        { icon: Rocket, title: 'Manage Ads', description: 'Ad campaigns', route: '/ads/my-ads', color: 'text-amber-500' },
        { icon: TrendingUp, title: 'Trending', route: '/feed/trending', color: 'text-orange-500' },
        { icon: BarChart3, title: 'Creator Dashboard', description: 'Analytics & earnings', route: '/creator/dashboard', color: 'text-emerald-500' },
      ],
    },
    {
      id: 'preferences',
      icon: Globe,
      label: 'Preferences',
      iconColor: 'text-teal-500',
      items: [
        { icon: Globe, title: 'Language', description: 'Display language', route: '/settings/language', color: 'text-teal-500' },
        { icon: Wallet, title: 'Currency & Location', route: '/settings/currency', color: 'text-emerald-500' },
        { icon: HardDrive, title: 'Cache & Storage', description: 'Manage app data', route: '/settings/cache', color: 'text-slate-500' },
        { icon: Download, title: 'Install App', description: 'Get the mobile app', route: '/install', color: 'text-purple-500' },
      ],
    },
    {
      id: 'support',
      icon: HelpCircle,
      label: 'Help & Legal',
      iconColor: 'text-cyan-500',
      items: [
        { icon: HelpCircle, title: 'Help & Support', description: 'FAQ & contact', route: '/settings/help', color: 'text-cyan-500' },
        { icon: Briefcase, title: 'For Investors', description: 'Risk & investor FAQ', route: '/settings/investors', color: 'text-emerald-500' },
        { icon: Scale, title: 'Terms of Service', route: '/settings/about?section=terms', color: 'text-blue-500' },
        { icon: Shield, title: 'Privacy Policy', route: '/settings/about?section=privacy', color: 'text-green-500' },
        { icon: Users, title: 'Community Guidelines', route: '/settings/about?section=community', color: 'text-purple-500' },
        { icon: FileText, title: 'Full Policy Document', route: '/settings/about', color: 'text-amber-500' },
      ],
    },
  ];

  const adminGroup: SettingsGroup = {
    id: 'admin',
    icon: ShieldCheck,
    label: 'Administration',
    iconColor: 'text-emerald-500',
    items: [
      { icon: Shield, title: 'Admin Panel', description: 'P2P, disputes & roles', route: '/admin/panel', color: 'text-primary' },
      { icon: ShieldCheck, title: 'FeedIn Wallet', description: 'Platform credits', route: '/wallet/admin', color: 'text-emerald-500' },
      { icon: Banknote, title: 'Creator Payouts', route: '/wallet/creator-payouts', color: 'text-green-500' },
      { icon: TrendingUp, title: 'Analytics', description: 'MAU, DAU & revenue', route: '/admin/analytics', color: 'text-blue-500' },
      { icon: Trash2, title: 'Deleted Posts', description: 'Search & restore', route: '/admin/deleted-posts', color: 'text-red-500' },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => navigate(`/profile/${userProfile?.username || user?.id}`)}
            size="icon"
            variant="ghost"
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={feedinLogo} alt="FEEDIN" className="w-8 h-8" />
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Settings
          </span>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto pb-24 space-y-3">

        {/* Dark Mode Toggle — inline compact */}
        <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl text-yellow-500 bg-secondary/50 flex items-center justify-center">
              {theme === 'dark' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </div>
            <span className="text-sm font-semibold text-foreground">Dark Mode</span>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
        </div>

        {/* Collapsible Setting Groups */}
        {groups.map(group => (
          <SettingsGroupCard
            key={group.id}
            group={group}
            isOpen={openGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            navigate={navigate}
          />
        ))}

        {/* Admin Section */}
        {canViewAdminWallet && (
          <SettingsGroupCard
            group={adminGroup}
            isOpen={openGroups.has('admin')}
            onToggle={() => toggleGroup('admin')}
            navigate={navigate}
          />
        )}

        {/* Referral Section */}
        <div id="referral-section" className="rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm p-4">
          <h3 className="text-sm font-bold mb-3 text-foreground flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" />
            Invite Friends & Earn
          </h3>
          <ReferralSection />
        </div>

        {/* Check for Updates + About */}
        <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-3 space-y-2">
          <div className="flex items-center gap-2 px-1 pb-1">
            <Info className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">About FeedIn</span>
          </div>
          <CheckForUpdatesButton />
        </div>

        {/* Sign Out */}
        <Button
          onClick={signOut}
          variant="outline"
          className="w-full justify-center border-destructive/30 text-destructive hover:bg-destructive/10 rounded-2xl h-12 font-semibold"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Settings;
