import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Bell, Heart, MessageCircle, UserPlus, Mail, 
  Gift, Users, Video, Zap, BellRing, BellOff, Smartphone
} from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    loading,
    preferences,
    enablePush,
    disablePush,
    updatePreference,
    updateAllPreferences,
  } = usePushNotifications();

  const [saving, setSaving] = useState(false);

  const handleTogglePush = async () => {
    setSaving(true);
    try {
      if (preferences.push_enabled && isSubscribed) {
        await disablePush();
        toast({
          title: 'Push notifications disabled',
          description: 'You will no longer receive push notifications',
        });
      } else {
        const success = await enablePush();
        if (success) {
          toast({
            title: 'Push notifications enabled',
            description: 'You will now receive push notifications',
          });
        } else if (permission === 'denied') {
          toast({
            title: 'Notifications blocked',
            description: 'Please enable notifications in your browser settings',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
    await updatePreference(key as any, value);
    toast({
      title: 'Setting updated',
      description: `${key.replace(/_/g, ' ')} ${value ? 'enabled' : 'disabled'}`,
    });
  };

  const handleEnableAll = async () => {
    await updateAllPreferences({
      likes_enabled: true,
      comments_enabled: true,
      messages_enabled: true,
      stories_enabled: true,
      friend_requests_enabled: true,
      gifts_enabled: true,
      follows_enabled: true,
      live_enabled: true,
    });
    toast({ title: 'All notifications enabled' });
  };

  const handleDisableAll = async () => {
    await updateAllPreferences({
      likes_enabled: false,
      comments_enabled: false,
      messages_enabled: false,
      stories_enabled: false,
      friend_requests_enabled: false,
      gifts_enabled: false,
      follows_enabled: false,
      live_enabled: false,
    });
    toast({ title: 'All notifications disabled' });
  };

  const notificationGroups = [
    {
      title: 'Social',
      items: [
        {
          key: 'likes_enabled' as const,
          icon: Heart,
          title: 'Likes',
          description: 'When someone likes your posts or comments',
          color: 'text-pink-500',
        },
        {
          key: 'comments_enabled' as const,
          icon: MessageCircle,
          title: 'Comments & Mentions',
          description: 'Comments on your posts and mentions',
          color: 'text-blue-500',
        },
        {
          key: 'follows_enabled' as const,
          icon: Users,
          title: 'New Followers',
          description: 'When someone follows you',
          color: 'text-purple-500',
        },
      ],
    },
    {
      title: 'Messages & Friends',
      items: [
        {
          key: 'messages_enabled' as const,
          icon: MessageCircle,
          title: 'Direct Messages',
          description: 'When you receive new messages',
          color: 'text-green-500',
        },
        {
          key: 'friend_requests_enabled' as const,
          icon: UserPlus,
          title: 'Friend Requests',
          description: 'New friend requests and acceptances',
          color: 'text-cyan-500',
        },
      ],
    },
    {
      title: 'Content',
      items: [
        {
          key: 'stories_enabled' as const,
          icon: Zap,
          title: 'Stories',
          description: 'Story replies and reactions',
          color: 'text-yellow-500',
        },
        {
          key: 'live_enabled' as const,
          icon: Video,
          title: 'Live Streams',
          description: 'Live invites and stream notifications',
          color: 'text-red-500',
        },
      ],
    },
    {
      title: 'Rewards',
      items: [
        {
          key: 'gifts_enabled' as const,
          icon: Gift,
          title: 'Gifts & Credits',
          description: 'When you receive gifts or credits',
          color: 'text-orange-500',
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Bell className="w-5 h-5 text-primary" />
            <span className="text-xl font-bold">Notifications</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24 space-y-6">
        {/* Push Notifications Master Toggle */}
        <Card className="bg-card border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-full ${preferences.push_enabled && isSubscribed ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {preferences.push_enabled && isSubscribed ? (
                  <BellRing className="w-6 h-6" />
                ) : (
                  <BellOff className="w-6 h-6" />
                )}
              </div>
              <div>
                <Label className="font-bold text-lg">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about activity even when you're not on Feedin
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.push_enabled && isSubscribed}
              onCheckedChange={handleTogglePush}
              disabled={saving || !isSupported}
            />
          </div>

          {!isSupported && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive">
                Push notifications are not supported in your browser
              </p>
            </div>
          )}

          {permission === 'denied' && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            </div>
          )}

          {isSubscribed && preferences.push_enabled && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                Active
              </Badge>
              <span className="text-xs text-muted-foreground">
                Push notifications are enabled
              </span>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEnableAll}
            className="flex-1"
          >
            Enable All
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDisableAll}
            className="flex-1"
          >
            Disable All
          </Button>
        </div>

        {/* Notification Categories */}
        {notificationGroups.map((group, groupIndex) => (
          <Card key={group.title} className="bg-card border-border p-6">
            <h3 className="font-bold text-lg mb-4">{group.title}</h3>
            <div className="space-y-4">
              {group.items.map((item, index) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={item.color}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <Label htmlFor={item.key} className="font-semibold cursor-pointer">
                          {item.title}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={item.key}
                      checked={preferences[item.key]}
                      onCheckedChange={(checked) => handleToggle(item.key, checked)}
                      disabled={!preferences.push_enabled}
                    />
                  </div>
                  {index < group.items.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </Card>
        ))}

        {/* Email Notifications */}
        <Card className="bg-card border-border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-blue-500">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <Label htmlFor="email_enabled" className="font-semibold cursor-pointer">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive important updates via email
                </p>
              </div>
            </div>
            <Switch
              id="email_enabled"
              checked={preferences.email_enabled}
              onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
            />
          </div>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50 border-border p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Push notifications work best when Feedin is installed as an app. 
                On mobile, add Feedin to your home screen for the best experience.
              </p>
            </div>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default NotificationSettings;