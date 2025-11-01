import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, UserX, VolumeX, Loader2 } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';

interface BlockedUser {
  id: string;
  blocked_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface MutedUser {
  id: string;
  muted_id: string;
  expires_at: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const BlockedUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadBlockedAndMuted();
  }, [user, navigate]);

  const loadBlockedAndMuted = async () => {
    try {
      setLoading(true);

      // Load blocked users with profile data
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_users')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user?.id);

      if (blockedError) throw blockedError;

      // Fetch profile data for blocked users
      const blockedWithProfiles = await Promise.all(
        (blocked || []).map(async (block) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', block.blocked_id)
            .single();
          
          return {
            ...block,
            profiles: profile || { display_name: null, username: null, avatar_url: null }
          };
        })
      );

      // Load muted users with profile data
      const { data: muted, error: mutedError } = await supabase
        .from('muted_users')
        .select('id, muted_id, expires_at, created_at')
        .eq('muter_id', user?.id);

      if (mutedError) throw mutedError;

      // Fetch profile data for muted users
      const mutedWithProfiles = await Promise.all(
        (muted || []).map(async (mute) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', mute.muted_id)
            .single();
          
          return {
            ...mute,
            profiles: profile || { display_name: null, username: null, avatar_url: null }
          };
        })
      );

      setBlockedUsers(blockedWithProfiles);
      setMutedUsers(mutedWithProfiles);
    } catch (error: any) {
      toast({
        title: 'Error loading users',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      setBlockedUsers(blockedUsers.filter((b) => b.id !== blockId));
      toast({
        title: 'User unblocked',
        description: 'You can now see their content again',
      });
    } catch (error: any) {
      toast({
        title: 'Error unblocking user',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUnmute = async (muteId: string) => {
    try {
      const { error } = await supabase
        .from('muted_users')
        .delete()
        .eq('id', muteId);

      if (error) throw error;

      setMutedUsers(mutedUsers.filter((m) => m.id !== muteId));
      toast({
        title: 'User unmuted',
        description: 'You will see notifications from them again',
      });
    } catch (error: any) {
      toast({
        title: 'Error unmuting user',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <UserX className="w-5 h-5 text-red-500" />
            <span className="text-xl font-bold">Blocked & Muted</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Tabs defaultValue="blocked" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
            <TabsTrigger value="muted">Muted</TabsTrigger>
          </TabsList>

          <TabsContent value="blocked">
            <Card className="bg-card border-border p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No blocked users</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {blockedUsers.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-accent/30"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={blocked.profiles.avatar_url || ''} />
                          <AvatarFallback>
                            {blocked.profiles.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">
                            {blocked.profiles.display_name || 'Unknown User'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            @{blocked.profiles.username || 'user'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleUnblock(blocked.id)}
                        variant="outline"
                        size="sm"
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="muted">
            <Card className="bg-card border-border p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : mutedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <VolumeX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No muted users</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mutedUsers.map((muted) => (
                    <div
                      key={muted.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-accent/30"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={muted.profiles.avatar_url || ''} />
                          <AvatarFallback>
                            {muted.profiles.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">
                            {muted.profiles.display_name || 'Unknown User'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            @{muted.profiles.username || 'user'}
                          </p>
                          {muted.expires_at && (
                            <p className="text-xs text-muted-foreground">
                              Expires: {new Date(muted.expires_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleUnmute(muted.id)}
                        variant="outline"
                        size="sm"
                      >
                        Unmute
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-card border-border mt-6 p-6">
          <h3 className="font-bold mb-2">About Blocking & Muting</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• <strong>Blocked users</strong> cannot see your profile, posts, or contact you</li>
            <li>• <strong>Muted users</strong> can still interact with you, but you won't see notifications</li>
            <li>• You can unblock or unmute users at any time</li>
          </ul>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default BlockedUsers;
