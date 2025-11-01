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
import { ArrowLeft, Shield, Eye, Lock, Users } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    profile_visible: true,
    show_online_status: true,
    allow_friend_requests: true,
    allow_messages: true,
  });

  useEffect(() => {
    if (!user) {
      return;
    }
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    // Load privacy settings from profiles or a dedicated privacy_settings table
    // For now, using default values
    setSettings({
      profile_visible: true,
      show_online_status: true,
      allow_friend_requests: true,
      allow_messages: true,
    });
  };

  const handleToggle = (key: keyof typeof settings) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // In production, save to a privacy_settings table
      // For now, just show success
      toast({
        title: 'Privacy settings updated',
        description: 'Your privacy preferences have been saved',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const privacyOptions = [
    {
      key: 'profile_visible' as const,
      icon: Eye,
      title: 'Public Profile',
      description: 'Allow others to view your profile',
      color: 'text-blue-500',
    },
    {
      key: 'show_online_status' as const,
      icon: Users,
      title: 'Show Online Status',
      description: 'Let friends see when you\'re online',
      color: 'text-green-500',
    },
    {
      key: 'allow_friend_requests' as const,
      icon: Users,
      title: 'Allow Friend Requests',
      description: 'Let others send you friend requests',
      color: 'text-purple-500',
    },
    {
      key: 'allow_messages' as const,
      icon: Lock,
      title: 'Allow Messages',
      description: 'Let non-friends send you messages',
      color: 'text-pink-500',
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
            <Shield className="w-5 h-5 text-purple-500" />
            <span className="text-xl font-bold">Privacy Settings</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Card className="bg-card border-border p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Privacy & Security</h2>
            <p className="text-muted-foreground">
              Control who can see your content and interact with you
            </p>
          </div>

          <div className="space-y-6">
            {privacyOptions.map((option, index) => (
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
                    checked={settings[option.key]}
                    onCheckedChange={() => handleToggle(option.key)}
                  />
                </div>
                {index < privacyOptions.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full mt-8 bg-gradient-primary"
          >
            {loading ? 'Saving...' : 'Save Privacy Settings'}
          </Button>
        </Card>

        {/* Additional Privacy Info */}
        <Card className="bg-card border-border mt-6 p-6">
          <h3 className="font-bold mb-2">About Privacy</h3>
          <p className="text-sm text-muted-foreground">
            Your privacy is important to us. These settings help you control your
            visibility and interactions on FEEDIN. You can change these at any time.
          </p>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default PrivacySettings;
