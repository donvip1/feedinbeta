import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, QrCode, Check, Link, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShareCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  callType: 'video' | 'voice';
}

export const ShareCallModal = ({ open, onOpenChange, callId, callType }: ShareCallModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInviteLink = async () => {
    if (!user || !callId) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-call-invite', {
        body: {
          callId,
          callType,
          expiresInMinutes: 30,
        },
      });

      if (error) throw error;

      setInviteCode(data.inviteCode);
      setInviteLink(data.inviteLink);
    } catch (error: any) {
      console.error('Error generating invite:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invite link',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Invite link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const shareNative = async () => {
    if (!inviteLink) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my ${callType} call on FeedIn`,
          text: `Click to join my ${callType} call`,
          url: inviteLink,
        });
      } catch (error) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Invite to Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!inviteLink ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Generate an invite link to share with others
              </p>
              <Button 
                onClick={generateInviteLink} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Link className="w-4 h-4 mr-2" />
                    Generate Invite Link
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite Code</label>
                <div className="flex items-center justify-center">
                  <div className="text-3xl font-mono font-bold tracking-wider text-primary">
                    {inviteCode}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Invite Link</label>
                <div className="flex gap-2">
                  <Input 
                    value={inviteLink} 
                    readOnly 
                    className="text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={copyToClipboard}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button 
                  onClick={shareNative}
                  className="flex-1"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                This invite expires in 30 minutes
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};