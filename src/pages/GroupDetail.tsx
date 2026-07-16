import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Users, UserPlus, Lock, Globe, Loader2 } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  is_private: boolean;
  is_premium?: boolean;
  requires_subscription: boolean;
  member_count: number;
  post_count: number;
  created_by: string;
  invite_code?: string;
}

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [actualMemberCount, setActualMemberCount] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadGroup();
  }, [user, groupId]);

  const loadGroup = async () => {
    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Get actual member count
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
      
      setActualMemberCount(count || 0);

      // Check if user is a member
      const { data: memberData } = await supabase
        .from('group_members')
        .select('id, role')
        .eq('group_id', groupId)
        .eq('user_id', user?.id)
        .single();

      setIsMember(!!memberData);

      const { data: pendingRequest } = await supabase
        .from('conversation_join_requests' as any)
        .select('id')
        .eq('conversation_id', groupId)
        .eq('requester_id', user?.id)
        .eq('status', 'pending')
        .maybeSingle();
      setRequestPending(!!pendingRequest);
      
      // If already a member, redirect to chat
      if (memberData) {
        navigate(`/groups/${groupId}/chat`, { replace: true });
        return;
      }
    } catch (error: any) {
      console.error('Error loading group:', error);
      toast({
        title: 'Error',
        description: 'Failed to load group',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('request_group_join' as any, {
        p_conversation_id: groupId,
        p_source: 'discovery',
      } as any);
      if (error) throw error;

      setRequestPending(true);
      toast({
        title: 'Request sent',
        description:
          'An owner or administrator must approve you. Approval costs 50 credits unless your premium subscription is active.',
      });
    } catch (error: any) {
      console.error('Error joining group:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to join group',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Group not found</p>
        <Button onClick={() => navigate('/messages')} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  // This page now only shows for non-members who want to join
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <Button
            onClick={() => navigate('/messages')}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Group Preview for Non-Members */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center text-center mb-8">
          <Avatar className="w-24 h-24 mb-4">
            <AvatarImage src={group.avatar_url} />
            <AvatarFallback className="text-2xl">{group.name[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            {group.is_private ? (
              <Lock className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Globe className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          <div className="flex items-center gap-1 text-muted-foreground mb-4">
            <Users className="w-4 h-4" />
            <span>{actualMemberCount} members</span>
          </div>
          
          {group.description && (
            <p className="text-muted-foreground max-w-md">{group.description}</p>
          )}
        </div>

        {/* Join Section */}
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
            <p className="text-sm text-slate-400 text-center">
              An owner or administrator must approve your request. If approved,
              50 credits will be charged unless your premium subscription is active.
            </p>
          </div>

          <Button
            onClick={handleJoinGroup}
            disabled={actionLoading || requestPending}
            className="w-full h-12"
            size="lg"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {requestPending ? 'Request Pending' : 'Request to Join'}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default GroupDetail;
