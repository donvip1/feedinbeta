import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateGroupModal = ({ open, onOpenChange, onSuccess }: CreateGroupModalProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Group name is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: newGroup, error } = await supabase.rpc(
        'create_group_conversation' as any,
        {
          p_title: name.trim(),
          p_description: description.trim(),
          p_is_private: isPrivate,
        } as any,
      );

      if (error) throw error;

      toast({
        title: 'Group created!',
        description: 'Your group is ready. A shareable link has been generated automatically.',
      });

      setName('');
      setDescription('');
      setIsPrivate(false);
      onOpenChange(false);
      
      // Navigate to the new group chat
      const created = newGroup as unknown as { id?: string } | null;
      if (created?.id) {
        navigate(`/groups/${created.id}/chat`);
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Error creating group:', error);
      const premiumRequired = error?.message?.includes('PREMIUM_REQUIRED');
      toast({
        title: premiumRequired ? 'Premium required' : 'Error',
        description: premiumRequired
          ? 'An active premium subscription is required to create a group.'
          : error.message || 'Failed to create group',
        variant: 'destructive',
      });
      if (premiumRequired) navigate('/wallet/credits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              placeholder="Enter group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Private Group</Label>
              <p className="text-sm text-muted-foreground">
                Only members can see posts
              </p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={loading}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
