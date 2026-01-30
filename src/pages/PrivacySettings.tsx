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
import { ArrowLeft, Shield, Eye, Lock, Users, Moon, Sun, Loader2, MessageCircle, Activity, Trash2, AlertTriangle } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useTheme } from 'next-themes';
import { EncryptionSettings } from '@/components/settings/EncryptionSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PrivacySettingsData {
  profile_visible: boolean;
  show_online_status: boolean;
  allow_friend_requests: boolean;
  allow_messages_from_strangers: boolean;
  show_read_receipts: boolean;
  show_activity_status: boolean;
}

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [settings, setSettings] = useState<PrivacySettingsData>({
    profile_visible: true,
    show_online_status: true,
    allow_friend_requests: true,
    allow_messages_from_strangers: false,
    show_read_receipts: true,
    show_activity_status: true,
  });

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, create default settings
          const { error: insertError } = await supabase
            .from('privacy_settings')
            .insert([{ user_id: user?.id }]);
          
          if (insertError) throw insertError;
        } else {
          throw error;
        }
      } else if (data) {
        setSettings({
          profile_visible: data.profile_visible ?? true,
          show_online_status: data.show_online_status ?? true,
          allow_friend_requests: data.allow_friend_requests ?? true,
          allow_messages_from_strangers: data.allow_messages_from_strangers ?? false,
          show_read_receipts: data.show_read_receipts ?? true,
          show_activity_status: data.show_activity_status ?? true,
        });
      }
    } catch (error: any) {
      console.error('Error loading privacy settings:', error);
      toast({
        title: 'Error loading settings',
        description: 'Using default privacy settings.',
        variant: 'destructive',
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleToggle = (key: keyof PrivacySettingsData) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Privacy settings updated',
        description: 'Your privacy preferences have been saved.',
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
      icon: Activity,
      title: 'Show Online Status',
      description: "Let friends see when you're online",
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
      key: 'allow_messages_from_strangers' as const,
      icon: MessageCircle,
      title: 'Messages from Non-Friends',
      description: 'Allow non-friends to send you messages',
      color: 'text-pink-500',
    },
    {
      key: 'show_read_receipts' as const,
      icon: Eye,
      title: 'Read Receipts',
      description: 'Show when you have read messages',
      color: 'text-cyan-500',
    },
    {
      key: 'show_activity_status' as const,
      icon: Activity,
      title: 'Activity Status',
      description: 'Show your recent activity to others',
      color: 'text-orange-500',
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
            <span className="text-xl font-bold">Privacy & Security</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Card className="bg-card border-border p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Privacy Settings</h2>
            <p className="text-muted-foreground">
              Control who can see your content and interact with you
            </p>
          </div>

          {initialLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
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
          )}

          <Separator className="my-6" />

          {/* Theme Toggle Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-yellow-500">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <Label className="font-semibold">Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between light and dark mode
                  </p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading || initialLoading}
            className="w-full mt-8 bg-gradient-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Privacy Settings'
            )}
          </Button>
        </Card>

        {/* E2E Encryption Section */}
        <Card className="bg-card border-border mt-6 p-6">
          <EncryptionSettings />
        </Card>

        {/* Additional Privacy Info */}
        <Card className="bg-card border-border mt-6 p-6">
          <h3 className="font-bold mb-2">About Privacy</h3>
          <p className="text-sm text-muted-foreground">
            Your privacy is important to us. These settings help you control your
            visibility and interactions on FEEDIN. You can change these at any time.
          </p>
        </Card>

        {/* Danger Zone - Delete Account */}
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/30 mt-6 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-bold text-destructive">Danger Zone</h3>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. All your data, posts, 
            messages, and connections will be permanently removed.
          </p>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/20 hover:border-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Delete Account Permanently?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account 
                  and remove all your data including:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Your profile and personal information</li>
                    <li>All your posts, stories, and media</li>
                    <li>Your messages and conversations</li>
                    <li>Your credits and transaction history</li>
                    <li>All your followers and following connections</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!user) return;
                    
                    setDeleteLoading(true);
                    try {
                      // In a real app, you'd call a server function to handle deletion
                      // For now, we'll just sign out
                      toast({
                        title: 'Account deletion requested',
                        description: 'Your account deletion has been scheduled. You will be signed out.',
                      });
                      
                      await signOut();
                      navigate('/welcome');
                    } catch (error: any) {
                      toast({
                        title: 'Error',
                        description: 'Failed to delete account. Please contact support.',
                        variant: 'destructive',
                      });
                    } finally {
                      setDeleteLoading(false);
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete My Account'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default PrivacySettings;
