import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Download,
  CheckCheck,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Users,
  MessageCircle,
  Coins,
  Wifi,
  WifiOff,
  Image,
  Video,
  Mic,
  FileText,
  Ban,
  Lock,
  Bell,
  BellOff,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TablesInsert } from '@/integrations/supabase/types';

interface MessageSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  secretMode?: boolean;
}

interface PrivacySettingsData {
  show_read_receipts: boolean;
  show_online_status: boolean;
  allow_messages_from_strangers: boolean;
}

interface LocalSettings {
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
  autoDownloadAudio: boolean;
  autoDownloadDocuments: boolean;
  autoDownloadOnWifiOnly: boolean;
  showTypingIndicators: boolean;
  sendTypingIndicators: boolean;
  messageNotifications: boolean;
  groupNotifications: boolean;
  storyNotifications: boolean;
  liveNotifications: boolean;
  chatRetention: '24h' | '7d' | '30d' | 'forever';
}

const defaultLocalSettings: LocalSettings = {
  autoDownloadImages: true,
  autoDownloadVideos: false,
  autoDownloadAudio: true,
  autoDownloadDocuments: false,
  autoDownloadOnWifiOnly: true,
  showTypingIndicators: true,
  sendTypingIndicators: true,
  messageNotifications: true,
  groupNotifications: true,
  storyNotifications: true,
  liveNotifications: true,
  chatRetention: 'forever',
};

const defaultPrivacySettings: PrivacySettingsData = {
  show_read_receipts: true,
  show_online_status: true,
  allow_messages_from_strangers: false,
};

export const MessageSettingsSheet = ({
  isOpen,
  onClose,
  secretMode = false,
}: MessageSettingsSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [privacySettings, setPrivacySettings] = useState<PrivacySettingsData>(defaultPrivacySettings);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  
  // Local settings stored in localStorage
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => {
    const stored = localStorage.getItem('message_settings');
    return stored ? { ...defaultLocalSettings, ...JSON.parse(stored) } : defaultLocalSettings;
  });

  // Load privacy settings from Supabase
  useEffect(() => {
    if (!user || !isOpen) return;
    
    const loadPrivacySettings = async () => {
      try {
        const { data, error } = await supabase
          .from('privacy_settings')
          .select('show_read_receipts, show_online_status, allow_messages_from_strangers')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading privacy settings:', error);
          return;
        }

        if (data) {
          setPrivacySettings({
            show_read_receipts: data.show_read_receipts ?? true,
            show_online_status: data.show_online_status ?? true,
            allow_messages_from_strangers: data.allow_messages_from_strangers ?? false,
          });
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setPrivacyLoading(false);
      }
    };

    loadPrivacySettings();
  }, [user, isOpen]);

  // Save local settings whenever they change
  useEffect(() => {
    localStorage.setItem('message_settings', JSON.stringify(localSettings));
  }, [localSettings]);

  const updateLocalSetting = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const updatePrivacySetting = async <K extends keyof PrivacySettingsData>(key: K, value: PrivacySettingsData[K]) => {
    if (!user) return;
    
    // Optimistic update
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
    
    try {
      const payload: TablesInsert<'privacy_settings'> = {
        user_id: user.id,
        [key]: value,
      };
      const { error } = await supabase
        .from('privacy_settings')
        .upsert(payload, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (error) {
      // Revert on error
      setPrivacySettings(prev => ({ ...prev, [key]: !value }));
      toast.error('Failed to update setting');
      console.error('Error updating privacy setting:', error);
    }
  };

  const SettingRow = ({
    icon: Icon,
    title,
    description,
    checked,
    onChange,
    disabled = false,
    iconColor = 'text-primary',
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    iconColor?: string;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center",
          secretMode ? "bg-slate-800" : "bg-muted"
        )}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <div>
          <Label className="font-medium">{title}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );

  const NavigationRow = ({
    icon: Icon,
    title,
    description,
    onClick,
    iconColor = 'text-primary',
    badge,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    onClick: () => void;
    iconColor?: string;
    badge?: string;
  }) => (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between py-3 transition-colors rounded-lg px-1",
        secretMode ? "hover:bg-slate-800/50" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center",
          secretMode ? "bg-slate-800" : "bg-muted"
        )}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <Label className="font-medium cursor-pointer">{title}</Label>
            {badge && (
              <Badge variant="secondary" className="text-xs">{badge}</Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className={cn(
      "text-xs font-semibold uppercase tracking-wider mb-2 mt-4",
      secretMode ? "text-slate-400" : "text-muted-foreground"
    )}>
      {title}
    </h3>
  );

  const retentionOptions = [
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'forever', label: 'Forever' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className={cn(
          "w-full sm:max-w-md p-0",
          secretMode && "bg-slate-900 border-slate-800"
        )}
      >
        <SheetHeader className={cn(
          "p-4 border-b",
          secretMode ? "border-slate-800" : "border-border"
        )}>
          <SheetTitle className={secretMode ? "text-white" : ""}>
            Message Settings
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-1">
            {/* Auto Download Section */}
            <SectionHeader title="Auto Download Media" />
            
            <SettingRow
              icon={Image}
              title="Images"
              description="Auto-download photos"
              checked={localSettings.autoDownloadImages}
              onChange={(v) => updateLocalSetting('autoDownloadImages', v)}
              iconColor="text-sky-500"
            />
            
            <SettingRow
              icon={Video}
              title="Videos"
              description="Auto-download videos"
              checked={localSettings.autoDownloadVideos}
              onChange={(v) => updateLocalSetting('autoDownloadVideos', v)}
              iconColor="text-violet-500"
            />
            
            <SettingRow
              icon={Mic}
              title="Voice Messages"
              description="Auto-download audio"
              checked={localSettings.autoDownloadAudio}
              onChange={(v) => updateLocalSetting('autoDownloadAudio', v)}
              iconColor="text-emerald-500"
            />
            
            <SettingRow
              icon={FileText}
              title="Documents"
              description="Auto-download files"
              checked={localSettings.autoDownloadDocuments}
              onChange={(v) => updateLocalSetting('autoDownloadDocuments', v)}
              iconColor="text-amber-500"
            />
            
            <SettingRow
              icon={localSettings.autoDownloadOnWifiOnly ? Wifi : WifiOff}
              title="Wi-Fi Only"
              description="Only auto-download on Wi-Fi"
              checked={localSettings.autoDownloadOnWifiOnly}
              onChange={(v) => updateLocalSetting('autoDownloadOnWifiOnly', v)}
              iconColor="text-cyan-500"
            />

            <Separator className={cn("my-4", secretMode && "bg-slate-700")} />

            {/* Read Receipts & Activity */}
            <SectionHeader title="Read Receipts & Activity" />
            
            <SettingRow
              icon={CheckCheck}
              title="Show Read Receipts"
              description="Let others see when you've read messages"
              checked={privacySettings.show_read_receipts}
              onChange={(v) => updatePrivacySetting('show_read_receipts', v)}
              disabled={privacyLoading}
              iconColor="text-sky-500"
            />
            
            <SettingRow
              icon={Eye}
              title="Show Typing Indicators"
              description="See when others are typing"
              checked={localSettings.showTypingIndicators}
              onChange={(v) => updateLocalSetting('showTypingIndicators', v)}
              iconColor="text-emerald-500"
            />
            
            <SettingRow
              icon={localSettings.sendTypingIndicators ? Eye : EyeOff}
              title="Send Typing Indicators"
              description="Let others see when you're typing"
              checked={localSettings.sendTypingIndicators}
              onChange={(v) => updateLocalSetting('sendTypingIndicators', v)}
              iconColor="text-teal-500"
            />
            
            <SettingRow
              icon={Eye}
              title="Online Status"
              description="Show when you're online"
              checked={privacySettings.show_online_status}
              onChange={(v) => updatePrivacySetting('show_online_status', v)}
              disabled={privacyLoading}
              iconColor="text-emerald-500"
            />

            <Separator className={cn("my-4", secretMode && "bg-slate-700")} />

            {/* Notifications */}
            <SectionHeader title="Notifications" />
            
            <SettingRow
              icon={MessageCircle}
              title="Message Notifications"
              description="Get notified of new messages"
              checked={localSettings.messageNotifications}
              onChange={(v) => updateLocalSetting('messageNotifications', v)}
              iconColor="text-sky-500"
            />
            
            <SettingRow
              icon={Users}
              title="Group Notifications"
              description="Get notified of group messages"
              checked={localSettings.groupNotifications}
              onChange={(v) => updateLocalSetting('groupNotifications', v)}
              iconColor="text-violet-500"
            />
            
            <SettingRow
              icon={Bell}
              title="Story Notifications"
              description="Get notified when friends post stories"
              checked={localSettings.storyNotifications}
              onChange={(v) => updateLocalSetting('storyNotifications', v)}
              iconColor="text-pink-500"
            />
            
            <SettingRow
              icon={localSettings.liveNotifications ? Bell : BellOff}
              title="Live Notifications"
              description="Get notified when friends go live"
              checked={localSettings.liveNotifications}
              onChange={(v) => updateLocalSetting('liveNotifications', v)}
              iconColor="text-rose-500"
            />

            <Separator className={cn("my-4", secretMode && "bg-slate-700")} />

            {/* Privacy */}
            <SectionHeader title="Privacy" />
            
            <SettingRow
              icon={MessageCircle}
              title="Messages from Non-Friends"
              description="Allow strangers to message you"
              checked={privacySettings.allow_messages_from_strangers}
              onChange={(v) => updatePrivacySetting('allow_messages_from_strangers', v)}
              disabled={privacyLoading}
              iconColor="text-pink-500"
            />
            
            <NavigationRow
              icon={Ban}
              title="Blocked Users"
              description="Manage blocked accounts"
              onClick={() => {
                onClose();
                navigate('/blocked-users');
              }}
              iconColor="text-destructive"
            />
            
            <NavigationRow
              icon={Shield}
              title="Full Privacy Settings"
              description="All privacy options"
              onClick={() => {
                onClose();
                navigate('/settings/privacy');
              }}
              iconColor="text-primary"
            />

            <Separator className={cn("my-4", secretMode && "bg-slate-700")} />

            {/* Credits & Gifting */}
            <SectionHeader title="Credits & Gifting" />
            
            <NavigationRow
              icon={Coins}
              title="Gift Credits"
              description="Send credits to friends"
              onClick={() => {
                onClose();
                navigate('/wallet');
              }}
              iconColor="text-yellow-500"
            />
            
            <NavigationRow
              icon={Coins}
              title="Credit Rules"
              description="View messaging credit costs"
              onClick={() => {
                onClose();
                navigate('/wallet/credit-rules');
              }}
              iconColor="text-amber-500"
              badge="1 credit/AI reply"
            />

            <Separator className={cn("my-4", secretMode && "bg-slate-700")} />

            {/* Chat Retention */}
            <SectionHeader title="Chat Retention" />
            
            <div className="py-2">
              <Label className="text-sm font-medium mb-3 block">Keep messages for:</Label>
              <div className="flex flex-wrap gap-2">
                {retentionOptions.map(opt => (
                  <Button
                    key={opt.value}
                    variant={localSettings.chatRetention === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateLocalSetting('chatRetention', opt.value as LocalSettings['chatRetention'])}
                    className={cn(
                      secretMode && localSettings.chatRetention !== opt.value && "border-slate-600 text-slate-300"
                    )}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Messages older than this will be automatically deleted
              </p>
            </div>

            <Separator className={cn("my-4", secretMode && "bg-slate-700")} />

            {/* Danger Zone */}
            <SectionHeader title="Data Management" />
            
            <NavigationRow
              icon={Trash2}
              title="Clear All Chats"
              description="Delete all messages permanently"
              onClick={() => {
                toast.info('Clear chats feature coming soon');
                onClose();
              }}
              iconColor="text-destructive"
            />

            <div className="h-8" />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
