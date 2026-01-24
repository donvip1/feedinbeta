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
      // Check if group is premium and user has premium subscription
      if (group?.is_premium || group?.requires_subscription) {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('status, subscription_tiers(name)')
          .eq('user_id', user?.id)
          .eq('status', 'active')
          .single();

        const tier = Array.isArray(subscription?.subscription_tiers)
          ? subscription.subscription_tiers[0]
          : subscription?.subscription_tiers;

        const isPremium = subscription && (tier?.name === 'Pro' || tier?.name === 'Premium');

        if (!isPremium) {
          toast({
            title: 'Premium Required',
            description: 'This group requires a premium subscription. Upgrade to join!',
            variant: 'destructive',
          });
          setActionLoading(false);
          return;
        }
      }

      if (group?.is_private) {
        // Create join request
        const { error } = await supabase.from('group_join_requests').insert({
          group_id: groupId,
          user_id: user?.id,
        });

        if (error) throw error;

        toast({
          title: 'Request Sent',
          description: 'Your join request has been sent to group admins',
        });
      } else {
        // Join directly
        const { error } = await supabase.from('group_members').insert({
          group_id: groupId,
          user_id: user?.id,
          role: 'member',
        });

        if (error) throw error;

        toast({
          title: 'Joined!',
          description: 'Welcome to the group',
        });
        
        // Navigate to chat after joining
        navigate(`/groups/${groupId}/chat`, { replace: true });
      }
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
              {group.is_private 
                ? 'This is a private group. Your request will be reviewed by admins.'
                : 'This is a public group. You can join and start chatting immediately!'
              }
            </p>
          </div>

          <Button
            onClick={handleJoinGroup}
            disabled={actionLoading}
            className="w-full h-12"
            size="lg"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {group.is_private ? 'Request to Join' : 'Join Group'}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default GroupDetail;
