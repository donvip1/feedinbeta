import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft } from 'lucide-react';

interface NotificationPreferencesProps {
  onClose: () => void;
  onBack: () => void;
}

export const NotificationPreferences = ({ onClose, onBack }: NotificationPreferencesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState({
    likes_enabled: true,
    comments_enabled: true,
    messages_enabled: true,
    stories_enabled: true,
    email_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          likes_enabled: data.likes_enabled,
          comments_enabled: data.comments_enabled,
          messages_enabled: data.messages_enabled,
          stories_enabled: data.stories_enabled,
          email_enabled: data.email_enabled,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error loading preferences',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Preferences saved',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed right-4 top-16 w-96 bg-background border border-border rounded-lg shadow-lg z-50 p-4">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-16 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-lg font-semibold">Notification Preferences</h3>
        </div>
      </div>

      {/* Preferences */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="likes">Likes</Label>
            <p className="text-sm text-muted-foreground">Get notified when someone likes your posts</p>
          </div>
          <Switch
            id="likes"
            checked={preferences.likes_enabled}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, likes_enabled: checked })
            }
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="comments">Comments</Label>
            <p className="text-sm text-muted-foreground">Get notified when someone comments on your posts</p>
          </div>
          <Switch
            id="comments"
            checked={preferences.comments_enabled}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, comments_enabled: checked })
            }
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="messages">Messages</Label>
            <p className="text-sm text-muted-foreground">Get notified when you receive new messages</p>
          </div>
          <Switch
            id="messages"
            checked={preferences.messages_enabled}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, messages_enabled: checked })
            }
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="stories">Stories</Label>
            <p className="text-sm text-muted-foreground">Get notified about story updates</p>
          </div>
          <Switch
            id="stories"
            checked={preferences.stories_enabled}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, stories_enabled: checked })
            }
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="email">Email Notifications</Label>
            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
          </div>
          <Switch
            id="email"
            checked={preferences.email_enabled}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, email_enabled: checked })
            }
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-pink-500 to-blue-500"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};
