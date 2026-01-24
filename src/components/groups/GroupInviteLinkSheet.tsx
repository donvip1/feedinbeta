import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Copy, Link, Clock, RefreshCw, Trash2, Check, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface GroupInviteLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  isAdmin: boolean;
}

interface InviteLink {
  id: string;
  invite_code: string;
  expires_at: string | null;
  is_revoked: boolean;
  use_count: number;
  max_uses: number | null;
  link_type: string;
  created_at: string;
}

const EXPIRY_OPTIONS = [
  { value: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '48h', label: '48 hours', ms: 48 * 60 * 60 * 1000 },
  { value: '1w', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'never', label: 'Never expires', ms: null },
];

export const GroupInviteLinkSheet = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  isAdmin,
}: GroupInviteLinkSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('24h');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && groupId) {
      loadLinks();
    }
  }, [open, groupId]);

  const loadLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('group_invite_links')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error loading invite links:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createLink = async () => {
    if (!user || !isAdmin) return;
    setCreating(true);

    try {
      const expiryOption = EXPIRY_OPTIONS.find(o => o.value === selectedExpiry);
      const expiresAt = expiryOption?.ms 
        ? new Date(Date.now() + expiryOption.ms).toISOString()
        : null;

      const { data, error } = await supabase
        .from('group_invite_links')
        .insert({
          group_id: groupId,
          invite_code: generateInviteCode(),
          created_by: user.id,
          expires_at: expiresAt,
          link_type: expiresAt ? 'temporary' : 'permanent',
        })
        .select()
        .single();

      if (error) throw error;

      setLinks(prev => [data, ...prev]);
      toast({
        title: 'Invite link created',
        description: 'Share this link with people you want to invite',
      });
    } catch (error: any) {
      console.error('Error creating link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invite link',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const revokeLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('group_invite_links')
        .update({ is_revoked: true })
        .eq('id', linkId);

      if (error) throw error;

      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast({ title: 'Link revoked' });
    } catch (error) {
      console.error('Error revoking link:', error);
    }
  };

  const copyLink = async (inviteCode: string, linkId: string) => {
    const fullUrl = `${window.location.origin}/groups/join/${inviteCode}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Link copied!' });
  };

  const shareLink = async (inviteCode: string) => {
    const fullUrl = `${window.location.origin}/groups/join/${inviteCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName}`,
          text: `You're invited to join ${groupName} on FeedIn!`,
          url: fullUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: 'Link copied!' });
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const activeLinks = links.filter(l => !isExpired(l.expires_at));
  const defaultLink = activeLinks.find(l => l.link_type === 'default');
  const customLinks = activeLinks.filter(l => l.link_type !== 'default');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-slate-900 border-slate-800">
        <SheetHeader className="pb-4 border-b border-slate-800">
          <SheetTitle className="text-white flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            Invite Links
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-6 overflow-y-auto max-h-[calc(85vh-100px)]">
          {/* Create New Link Section */}
          {isAdmin && (
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Create New Link</h3>
              
              <div className="space-y-3">
                <Label className="text-slate-400 text-xs">Link Expiry</Label>
                <RadioGroup 
                  value={selectedExpiry} 
                  onValueChange={setSelectedExpiry}
                  className="grid grid-cols-3 gap-2"
                >
                  {EXPIRY_OPTIONS.map(option => (
                    <div key={option.value}>
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={option.value}
                        className={cn(
                          "flex items-center justify-center px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all",
                          selectedExpiry === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button 
                onClick={createLink} 
                disabled={creating}
                className="w-full"
              >
                {creating ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Link className="w-4 h-4 mr-2" />
                )}
                Generate Invite Link
              </Button>
            </div>
          )}

          {/* Default Group Link */}
          {defaultLink && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Link className="w-4 h-4" />
                Default Group Link
              </h3>
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Share this link to invite people</p>
                    <code className="text-sm text-primary bg-slate-900/50 px-2 py-1 rounded">
                      {defaultLink.invite_code}
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => copyLink(defaultLink.invite_code, defaultLink.id)}
                  >
                    {copiedId === defaultLink.id ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-primary" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {defaultLink.use_count} joined
                  </span>
                  <span className="text-green-400">• Never expires</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => shareLink(defaultLink.invite_code)}
                >
                  Share Link
                </Button>
              </div>
            </div>
          )}

          {/* Custom Links (for events, temporary access, etc.) */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Custom Links ({customLinks.length})
            </h3>
            
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : customLinks.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                {isAdmin 
                  ? 'Create custom links for events or temporary access'
                  : 'No custom invite links available'
                }
              </div>
            ) : (
              <div className="space-y-2">
                {customLinks.map(link => (
                  <div
                    key={link.id}
                    className="bg-slate-800 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-primary bg-slate-900 px-2 py-1 rounded">
                        {link.invite_code}
                      </code>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyLink(link.invite_code, link.id)}
                        >
                          {copiedId === link.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300"
                            onClick={() => revokeLink(link.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {link.use_count} uses
                        </span>
                        {link.expires_at && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Clock className="w-3 h-3" />
                            Expires {format(new Date(link.expires_at), 'MMM d, h:mm a')}
                          </span>
                        )}
                        {!link.expires_at && (
                          <span className="text-green-500">Never expires</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => shareLink(link.invite_code)}
                    >
                      Share Link
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GroupInviteLinkSheet;
