import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Bell, Heart, MessageCircle, UserPlus, Mail } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    likes_enabled: true,
    comments_enabled: true,
    messages_enabled: true,
    stories_enabled: true,
    email_enabled: false,
  });

  useEffect(() => {
    if (!user) {
      return;
    }
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        // Create default preferences if they don't exist
        const { error: insertError } = await supabase
          .from('notification_preferences')
          .insert([{ user_id: user?.id }]);
        
        if (insertError) throw insertError;
      } else {
        setPreferences(data);
      }
    } catch (error: any) {
      console.error('Error loading preferences:', error);
    }
  };

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update(preferences)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Preferences saved',
        description: 'Your notification settings have been updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const notificationOptions = [
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
      title: 'Comments',
      description: 'When someone comments on your posts',
      color: 'text-blue-500',
    },
    {
      key: 'messages_enabled' as const,
      icon: MessageCircle,
      title: 'Messages',
      description: 'When you receive new messages',
      color: 'text-purple-500',
    },
    {
      key: 'stories_enabled' as const,
      icon: UserPlus,
      title: 'Stories',
      description: 'When friends post new stories',
      color: 'text-cyan-500',
    },
    {
      key: 'email_enabled' as const,
      icon: Mail,
      title: 'Email Notifications',
      description: 'Receive important updates via email',
      color: 'text-green-500',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Bell className="w-5 h-5 text-pink-500" />
            <span className="text-xl font-bold">Notifications</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Card className="bg-card border-border p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Notification Preferences</h2>
            <p className="text-muted-foreground">
              Choose what notifications you want to receive
            </p>
          </div>

          <div className="space-y-6">
            {notificationOptions.map((option, index) => (
              <div key={option.key}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={option.color}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <Label htmlFor={option.key} className="font-semibold cursor-pointer">
                        {option.title}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={option.key}
                    checked={preferences[option.key]}
                    onCheckedChange={() => handleToggle(option.key)}
                  />
                </div>
                {index < notificationOptions.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full mt-8 bg-gradient-primary"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </Card>

        {/* Info Card */}
        <Card className="bg-card border-border mt-6 p-6">
          <h3 className="font-bold mb-2">Push Notifications</h3>
          <p className="text-sm text-muted-foreground">
            To receive push notifications on your device, make sure notifications
            are enabled in your browser or device settings.
          </p>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default NotificationSettings;
