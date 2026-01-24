import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/navigation/BottomNav';
import { GroupInviteLinkSheet } from '@/components/groups/GroupInviteLinkSheet';
import { ArrowLeft, Users, Settings, UserPlus, UserCheck, MessageCircle, Link, Lock, Globe } from 'lucide-react';

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

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

      // Check if user is a member and their role
      const { data: memberData } = await supabase
        .from('group_members')
        .select('id, role')
        .eq('group_id', groupId)
        .eq('user_id', user?.id)
        .single();

      setIsMember(!!memberData);
      setIsAdmin(memberData?.role === 'admin' || memberData?.role === 'owner' || memberData?.role === 'moderator');
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

        setIsMember(true);
        toast({
          title: 'Joined',
          description: 'You are now a member of this group',
        });
        loadGroup();
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

  const handleLeaveGroup = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setIsMember(false);
      setIsAdmin(false);
      toast({
        title: 'Left Group',
        description: 'You have left the group',
      });
      loadGroup();
    } catch (error: any) {
      console.error('Error leaving group:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave group',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => navigate('/messages')}
              variant="ghost"
              size="icon"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              {isMember && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInviteSheet(true)}
                >
                  <Link className="w-5 h-5" />
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toast({ title: 'Settings coming soon' })}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Group Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-4 mb-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={group.avatar_url} />
              <AvatarFallback>{group.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{group.name}</h1>
                {group.is_private ? (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Globe className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-muted-foreground mb-3">{group.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {group.member_count} members
                </div>
                <span>{group.post_count} posts</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {isMember ? (
                  <>
                    <Button
                      onClick={() => navigate(`/groups/${groupId}/chat`)}
                      className="flex-1 min-w-[120px]"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Open Chat
                    </Button>
                    <Button
                      onClick={handleLeaveGroup}
                      disabled={actionLoading}
                      variant="outline"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Joined
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleJoinGroup}
                    disabled={actionLoading}
                    className="w-full"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {group.is_private ? 'Request to Join' : 'Join Group'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="posts">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
            <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
            <TabsTrigger value="about" className="flex-1">About</TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-6">
            {isMember ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Group posts will appear here</p>
                <Button onClick={() => navigate(`/groups/${groupId}/chat`)}>
                  Go to Chat
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Join the group to view posts
              </div>
            )}
          </TabsContent>
          <TabsContent value="members" className="mt-6">
            {isMember ? (
              <div className="text-center py-12 text-muted-foreground">
                Group members will appear here
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Join the group to view members
              </div>
            )}
          </TabsContent>
          <TabsContent value="about" className="mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{group.description}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Privacy</h3>
                <p className="text-muted-foreground">
                  {group.is_private ? 'Private Group - Only members can see content' : 'Public Group - Anyone can join and view content'}
                </p>
              </div>
              {isAdmin && (
                <div>
                  <h3 className="font-semibold mb-2">Invite Links</h3>
                  <Button variant="outline" onClick={() => setShowInviteSheet(true)}>
                    <Link className="w-4 h-4 mr-2" />
                    Manage Invite Links
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Links Sheet */}
      <GroupInviteLinkSheet
        open={showInviteSheet}
        onOpenChange={setShowInviteSheet}
        groupId={groupId || ''}
        groupName={group.name}
        isAdmin={isAdmin}
      />

      <BottomNav />
    </div>
  );
};

export default GroupDetail;
