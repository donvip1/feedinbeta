import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Heart, 
  Briefcase, 
  Link2,
  Eye,
  EyeOff,
  Shield,
  Users,
  MessageCircle,
  Activity,
  CheckCircle
} from 'lucide-react';

interface PrivacySettingsData {
  profile_visible: boolean;
  show_online_status: boolean;
  allow_friend_requests: boolean;
  allow_messages_from_strangers: boolean;
  show_read_receipts: boolean;
  show_activity_status: boolean;
  show_phone_number: boolean;
  show_email: boolean;
  show_date_of_birth: boolean;
  show_location: boolean;
  show_marital_status: boolean;
  show_occupation: boolean;
  show_social_links: boolean;
}

const DEFAULT_SETTINGS: PrivacySettingsData = {
  profile_visible: true,
  show_online_status: true,
  allow_friend_requests: true,
  allow_messages_from_strangers: false,
  show_read_receipts: true,
  show_activity_status: true,
  show_phone_number: false,
  show_email: false,
  show_date_of_birth: false,
  show_location: true,
  show_marital_status: false,
  show_occupation: true,
  show_social_links: true,
};

export const PrivacySettingsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PrivacySettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<PrivacySettingsData>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const loadedSettings: PrivacySettingsData = {
          profile_visible: data.profile_visible ?? true,
          show_online_status: data.show_online_status ?? true,
          allow_friend_requests: data.allow_friend_requests ?? true,
          allow_messages_from_strangers: data.allow_messages_from_strangers ?? false,
          show_read_receipts: data.show_read_receipts ?? true,
          show_activity_status: data.show_activity_status ?? true,
          show_phone_number: data.show_phone_number ?? false,
          show_email: data.show_email ?? false,
          show_date_of_birth: data.show_date_of_birth ?? false,
          show_location: data.show_location ?? true,
          show_marital_status: data.show_marital_status ?? false,
          show_occupation: data.show_occupation ?? true,
          show_social_links: data.show_social_links ?? true,
        };
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading privacy settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key: keyof PrivacySettingsData, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setOriginalSettings(settings);
      setHasChanges(false);
      toast({
        title: 'Privacy settings saved',
        description: 'Your privacy preferences have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Information Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Personal Information Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your personal details. By default, sensitive information is hidden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrivacyToggle
            icon={<Phone className="h-4 w-4" />}
            label="Phone Number"
            description="Show your phone number on your profile"
            checked={settings.show_phone_number}
            onChange={(checked) => updateSetting('show_phone_number', checked)}
            sensitive
          />
          <Separator />
          <PrivacyToggle
            icon={<Mail className="h-4 w-4" />}
            label="Email Address"
            description="Show your email address on your profile"
            checked={settings.show_email}
            onChange={(checked) => updateSetting('show_email', checked)}
            sensitive
          />
          <Separator />
          <PrivacyToggle
            icon={<Calendar className="h-4 w-4" />}
            label="Date of Birth"
            description="Show your date of birth on your profile"
            checked={settings.show_date_of_birth}
            onChange={(checked) => updateSetting('show_date_of_birth', checked)}
            sensitive
          />
          <Separator />
          <PrivacyToggle
            icon={<MapPin className="h-4 w-4" />}
            label="Location"
            description="Show your city/country on your profile"
            checked={settings.show_location}
            onChange={(checked) => updateSetting('show_location', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<Heart className="h-4 w-4" />}
            label="Marital Status"
            description="Show your marital status on your profile"
            checked={settings.show_marital_status}
            onChange={(checked) => updateSetting('show_marital_status', checked)}
            sensitive
          />
          <Separator />
          <PrivacyToggle
            icon={<Briefcase className="h-4 w-4" />}
            label="Occupation"
            description="Show your occupation on your profile"
            checked={settings.show_occupation}
            onChange={(checked) => updateSetting('show_occupation', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<Link2 className="h-4 w-4" />}
            label="Social Links"
            description="Show your social media links on your profile"
            checked={settings.show_social_links}
            onChange={(checked) => updateSetting('show_social_links', checked)}
          />
        </CardContent>
      </Card>

      {/* Interaction Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Interaction Settings
          </CardTitle>
          <CardDescription>
            Control how others can interact with you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrivacyToggle
            icon={<Eye className="h-4 w-4" />}
            label="Profile Visibility"
            description="Allow others to view your profile"
            checked={settings.profile_visible}
            onChange={(checked) => updateSetting('profile_visible', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<Activity className="h-4 w-4" />}
            label="Online Status"
            description="Show when you're online"
            checked={settings.show_online_status}
            onChange={(checked) => updateSetting('show_online_status', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<Users className="h-4 w-4" />}
            label="Friend Requests"
            description="Allow others to send you friend requests"
            checked={settings.allow_friend_requests}
            onChange={(checked) => updateSetting('allow_friend_requests', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<MessageCircle className="h-4 w-4" />}
            label="Messages from Non-Friends"
            description="Allow messages from people you're not friends with"
            checked={settings.allow_messages_from_strangers}
            onChange={(checked) => updateSetting('allow_messages_from_strangers', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<CheckCircle className="h-4 w-4" />}
            label="Read Receipts"
            description="Let others know when you've read their messages"
            checked={settings.show_read_receipts}
            onChange={(checked) => updateSetting('show_read_receipts', checked)}
          />
          <Separator />
          <PrivacyToggle
            icon={<Activity className="h-4 w-4" />}
            label="Activity Status"
            description="Show your recent activity"
            checked={settings.show_activity_status}
            onChange={(checked) => updateSetting('show_activity_status', checked)}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-pink-500 to-blue-500 shadow-lg"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
};

interface PrivacyToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  sensitive?: boolean;
}

const PrivacyToggle = ({ icon, label, description, checked, onChange, sensitive }: PrivacyToggleProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${sensitive ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="space-y-0.5">
        <Label className="flex items-center gap-2">
          {label}
          {sensitive && (
            <span className="text-xs bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded">
              Sensitive
            </span>
          )}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {checked ? (
        <Eye className="h-4 w-4 text-green-500" />
      ) : (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      )}
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  </div>
);

export default PrivacySettingsPanel;
