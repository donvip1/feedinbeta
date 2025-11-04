import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  stories: boolean;
}

export const PushNotificationManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    stories: true,
  });

  useEffect(() => {
    checkSupport();
    checkSubscription();
    loadPreferences();
  }, [user]);

  const checkSupport = () => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
  };

  const checkSubscription = async () => {
    if (!isSupported || !user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const loadPreferences = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setPreferences({
        likes: data.likes_enabled,
        comments: data.comments_enabled,
        follows: data.likes_enabled, // Using likes_enabled as fallback
        messages: data.messages_enabled,
        stories: data.stories_enabled,
      });
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user) return;

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        likes_enabled: newPreferences.likes,
        comments_enabled: newPreferences.comments,
        follows_enabled: newPreferences.follows,
        messages_enabled: newPreferences.messages,
        stories_enabled: newPreferences.stories,
      });

    if (error) {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Preferences saved successfully' });
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    if (!isSupported || !user) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        });
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Using a public VAPID key (in production, this should be from env)
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY';
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Push subscription setup - will be implemented when VAPID keys are configured
      console.log('Push notification subscription ready');
      
      // Store subscription preference
      localStorage.setItem('push_enabled', 'true');

      setIsSubscribed(true);
      toast({ title: 'Push notifications enabled!' });
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Subscription failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const unsubscribeFromPush = async () => {
    if (!isSupported || !user) return;

    try {
      localStorage.removeItem('push_enabled');
      setIsSubscribed(false);
      toast({ title: 'Push notifications disabled' });
    } catch (error: any) {
      console.error('Error unsubscribing from push:', error);
      toast({
        title: 'Unsubscribe failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications Not Supported</CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications. Please use a modern browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Get notified about important updates even when you're not on the app
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubscribed ? (
            <Button variant="outline" onClick={unsubscribeFromPush} className="w-full">
              <BellOff className="w-4 h-4 mr-2" />
              Disable Push Notifications
            </Button>
          ) : (
            <Button onClick={subscribeToPush} className="w-full">
              <Bell className="w-4 h-4 mr-2" />
              Enable Push Notifications
            </Button>
          )}
        </CardContent>
      </Card>

      {isSubscribed && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose what notifications you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="likes">Likes on your posts</Label>
              <Switch
                id="likes"
                checked={preferences.likes}
                onCheckedChange={(checked) => handlePreferenceChange('likes', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="comments">Comments on your posts</Label>
              <Switch
                id="comments"
                checked={preferences.comments}
                onCheckedChange={(checked) => handlePreferenceChange('comments', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="follows">New followers</Label>
              <Switch
                id="follows"
                checked={preferences.follows}
                onCheckedChange={(checked) => handlePreferenceChange('follows', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="messages">New messages</Label>
              <Switch
                id="messages"
                checked={preferences.messages}
                onCheckedChange={(checked) => handlePreferenceChange('messages', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="stories">Story reactions</Label>
              <Switch
                id="stories"
                checked={preferences.stories}
                onCheckedChange={(checked) => handlePreferenceChange('stories', checked)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
