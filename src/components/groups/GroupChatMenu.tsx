import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Info, CheckSquare, BellOff, Bell, Timer, Heart, X, Trash2,
  LogOut, Copy, Check, Link, Clock, Users, Lock, Globe, UserPlus,
  Settings, Shield, Share2, Edit, UserMinus, Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GroupInviteLinkSheet } from './GroupInviteLinkSheet';

interface GroupChatMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  group: {
    id: string;
    name: string;
    avatar_url?: string | null;
    description?: string | null;
    is_private?: boolean;
  };
  isAdmin: boolean;
  isMember: boolean;
  memberCount: number;
  onShowInfo: () => void;
  onShowMembers: () => void;
  chatRetention: number;
  onRetentionChange: (value: number) => void;
}

// Retention options - only for private groups
const RETENTION_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 24 * 60 * 60 * 1000, label: '24 Hours' },
  { value: 7 * 24 * 60 * 60 * 1000, label: '7 Days' },
  { value: 30 * 24 * 60 * 60 * 1000, label: '1 Month' },
];

export const GroupChatMenu = ({
  open,
  onOpenChange,
  groupId,
  group,
  isAdmin,
  isMember,
  memberCount,
  onShowInfo,
  onShowMembers,
  chatRetention,
  onRetentionChange,
}: GroupChatMenuProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [showDisappearing, setShowDisappearing] = useState(false);
  const [showInviteManager, setShowInviteManager] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeInviteLink, setActiveInviteLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    if (open && groupId) {
      loadActiveInviteLink();
      loadMuteStatus();
    }
  }, [open, groupId]);

  const loadActiveInviteLink = async () => {
    try {
      const { data } = await supabase
        .from('group_invite_links')
        .select('invite_code')
        .eq('group_id', groupId)
        .eq('is_revoked', false)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveInviteLink(data.invite_code);
      }
    } catch (error) {
      console.error('Error loading invite link:', error);
    }
  };

  const loadMuteStatus = async () => {
    // Load from local storage for now
    const muted = localStorage.getItem(`group_muted_${groupId}`) === 'true';
    const fav = localStorage.getItem(`group_favorite_${groupId}`) === 'true';
    setIsMuted(muted);
    setIsFavorite(fav);
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCopyInviteLink = async () => {
    setLoadingLink(true);
    try {
      let inviteCode = activeInviteLink;
      
      // If no active link exists and user is admin, create one
      if (!inviteCode && isAdmin) {
        const { data, error } = await supabase
          .from('group_invite_links')
          .insert({
            group_id: groupId,
            invite_code: generateInviteCode(),
            created_by: user?.id,
            link_type: 'permanent',
            expires_at: null,
          })
          .select()
          .single();

        if (error) throw error;
        inviteCode = data.invite_code;
        setActiveInviteLink(inviteCode);
      }

      if (inviteCode) {
        const fullUrl = `${window.location.origin}/groups/join/${inviteCode}`;
        await navigator.clipboard.writeText(fullUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast({ title: 'Invite link copied!' });
      } else {
        toast({
          title: 'No invite link',
          description: 'Ask an admin to create an invite link',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to copy link',
        variant: 'destructive',
      });
    } finally {
      setLoadingLink(false);
    }
  };

  const handleShare = async () => {
    let inviteCode = activeInviteLink;
    
    // If no invite link is loaded yet, fetch it first
    if (!inviteCode) {
      try {
        const { data } = await supabase
          .from('group_invite_links')
          .select('invite_code')
          .eq('group_id', groupId)
          .eq('is_revoked', false)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          inviteCode = data.invite_code;
          setActiveInviteLink(data.invite_code);
        }
      } catch (error) {
        console.error('Error fetching invite link:', error);
      }
    }

    if (!inviteCode) {
      toast({
        title: 'No invite link',
        description: 'Ask an admin to create an invite link',
        variant: 'destructive',
      });
      return;
    }

    const fullUrl = `${window.location.origin}/groups/join/${inviteCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group.name}`,
          text: `You're invited to join ${group.name} on FeedIn!`,
          url: fullUrl,
        });
      } catch (err) {
        // User cancelled - copy to clipboard as fallback
        await navigator.clipboard.writeText(fullUrl);
        toast({ title: 'Link copied!' });
      }
    } else {
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: 'Link copied!' });
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem(`group_muted_${groupId}`, String(newMuted));
    toast({ title: newMuted ? 'Notifications muted' : 'Notifications enabled' });
  };

  const handleFavoriteToggle = () => {
    const newFav = !isFavorite;
    setIsFavorite(newFav);
    localStorage.setItem(`group_favorite_${groupId}`, String(newFav));
    toast({ title: newFav ? 'Added to favorites' : 'Removed from favorites' });
  };

  const handleClearChat = async () => {
    // Clear local chat history (messages will still exist on server)
    localStorage.setItem(`group_cleared_${groupId}`, new Date().toISOString());
    toast({ title: 'Chat cleared locally' });
    onOpenChange(false);
  };

  const handleLeaveGroup = async () => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({ title: 'Left group' });
      navigate('/messages');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave group',
        variant: 'destructive',
      });
    }
  };

  const handleRetentionSelect = (value: number) => {
    onRetentionChange(value);
    setShowDisappearing(false);
    toast({ 
      title: value === 0 ? 'Disappearing messages off' : `Messages will auto-delete after ${RETENTION_OPTIONS.find(o => o.value === value)?.label}` 
    });
  };

  const MenuItem = ({ 
    icon: Icon, 
    label, 
    onClick, 
    rightElement,
    destructive = false,
    disabled = false,
  }: { 
    icon: React.ElementType; 
    label: string; 
    onClick?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-800/50 transition-colors text-left",
        destructive && "text-red-400 hover:text-red-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Icon className="w-5 h-5 text-slate-400" />
      <span className="flex-1 text-sm">{label}</span>
      {rightElement}
    </button>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl bg-slate-900 border-slate-800 p-0">
          {!showDisappearing ? (
            <>
              {/* Group Info Header */}
              <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                <img
                  src={group.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=6366f1&color=fff`}
                  className="w-12 h-12 rounded-full"
                  alt={group.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{group.name}</h3>
                    {group.is_private ? (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{memberCount} members</p>
                </div>
              </div>

              {/* Scrollable Menu Items */}
              <ScrollArea className="max-h-[calc(80vh-100px)]">
                <div className="py-2 pb-20">
                  <MenuItem
                    icon={Info}
                    label="Group info"
                    onClick={() => {
                      onOpenChange(false);
                      onShowInfo();
                    }}
                  />

                  <MenuItem
                    icon={Users}
                    label="View members"
                    onClick={() => {
                      onOpenChange(false);
                      onShowMembers();
                    }}
                  />

                  {/* Copy/Share Invite Link */}
                  <MenuItem
                    icon={copiedLink ? Check : Link}
                    label={copiedLink ? 'Link copied!' : 'Copy invite link'}
                    onClick={handleCopyInviteLink}
                    disabled={loadingLink}
                  />

                  <MenuItem
                    icon={Share2}
                    label="Share group"
                    onClick={handleShare}
                  />

                  <div className="border-t border-slate-800 my-2" />

                  <MenuItem
                    icon={CheckSquare}
                    label="Select messages"
                    onClick={() => {
                      setSelectMode(true);
                      onOpenChange(false);
                      toast({ title: 'Message selection coming soon' });
                    }}
                  />

                  <MenuItem
                    icon={isMuted ? Bell : BellOff}
                    label={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                    onClick={handleMuteToggle}
                  />

                  {/* Disappearing messages - ONLY for private groups */}
                  {group.is_private && (
                    <MenuItem
                      icon={Timer}
                      label="Disappearing messages"
                      onClick={() => setShowDisappearing(true)}
                      rightElement={
                        <span className="text-xs text-slate-500">
                          {chatRetention === 0 ? 'Off' : RETENTION_OPTIONS.find(o => o.value === chatRetention)?.label}
                        </span>
                      }
                    />
                  )}

                  <MenuItem
                    icon={Heart}
                    label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={handleFavoriteToggle}
                    rightElement={
                      isFavorite && <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                    }
                  />

                  <div className="border-t border-slate-800 my-2" />

                  {/* Admin Settings Section */}
                  {isAdmin && (
                    <>
                      <div className="px-4 py-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Admin Settings</p>
                      </div>

                      <MenuItem
                        icon={Settings}
                        label="Manage invite links"
                        onClick={() => {
                          onOpenChange(false);
                          setShowInviteManager(true);
                        }}
                      />

                      <MenuItem
                        icon={Edit}
                        label="Edit group info"
                        onClick={() => {
                          toast({ title: 'Edit group coming soon' });
                        }}
                      />

                      <div className="border-t border-slate-800 my-2" />
                    </>
                  )}

                  <MenuItem
                    icon={X}
                    label="Close chat"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/messages');
                    }}
                  />

                  <MenuItem
                    icon={Trash2}
                    label="Clear chat"
                    onClick={handleClearChat}
                  />

                  <div className="border-t border-slate-800 my-2" />

                  <MenuItem
                    icon={LogOut}
                    label="Exit group"
                    onClick={handleLeaveGroup}
                    destructive
                  />
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              {/* Disappearing Messages Sub-menu */}
              <SheetHeader className="p-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowDisappearing(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  <SheetTitle className="text-white flex items-center gap-2">
                    <Timer className="w-5 h-5 text-primary" />
                    Disappearing Messages
                  </SheetTitle>
                </div>
              </SheetHeader>

              <div className="p-4 space-y-4">
                <p className="text-sm text-slate-400">
                  When enabled, messages in this chat will automatically disappear after the selected time.
                </p>

                <RadioGroup
                  value={String(chatRetention)}
                  onValueChange={(v) => handleRetentionSelect(Number(v))}
                  className="space-y-2"
                >
                  {RETENTION_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                      <RadioGroupItem value={String(option.value)} id={`ret-${option.value}`} />
                      <Label htmlFor={`ret-${option.value}`} className="flex-1 cursor-pointer text-slate-300">
                        {option.label}
                      </Label>
                      {chatRetention === option.value && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Invite Link Manager Sheet */}
      <GroupInviteLinkSheet
        open={showInviteManager}
        onOpenChange={setShowInviteManager}
        groupId={groupId}
        groupName={group.name}
        isAdmin={isAdmin}
      />
    </>
  );
};

export default GroupChatMenu;
