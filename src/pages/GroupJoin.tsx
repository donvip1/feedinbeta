import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';

const GroupJoin = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'requested' | 'error' | 'already_member'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Store the invite code and redirect to auth
      sessionStorage.setItem('pendingGroupInvite', inviteCode || '');
      navigate('/auth');
      return;
    }

    joinGroup();
  }, [user, authLoading, inviteCode]);

  const joinGroup = async () => {
    if (!inviteCode || !user) return;

    try {
      const { data: linkedGroup, error: linkError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode.toLowerCase().trim())
        .maybeSingle();
      if (linkError) throw linkError;
      if (!linkedGroup?.id) throw new Error('GROUP_LINK_INVALID');

      setGroupId(linkedGroup.id);
      const { data: membership } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', linkedGroup.id)
        .eq('user_id', user.id)
        .eq('state', 'active')
        .maybeSingle();

      if (membership) {
        setStatus('already_member');
        toast({
          title: 'Already a member',
          description: 'You are already a member of this group',
        });
      } else {
        const { error } = await supabase.rpc('request_group_join' as any, {
          p_conversation_id: linkedGroup.id,
          p_source: 'public_link',
        } as any);
        if (error) throw error;

        setStatus('requested');
        toast({
          title: 'Request sent',
          description:
            'An owner or administrator must approve your request before you can join.',
        });
      }
    } catch (error: any) {
      console.error('Error joining group:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to join group');
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-slate-400">Checking group link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 text-center space-y-6">
        {status === 'requested' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Request Sent</h1>
            <p className="text-slate-400">
              An owner or administrator must approve your request. If approved,
              50 credits will be charged unless your premium subscription is active.
            </p>
            <Button className="w-full" onClick={() => navigate('/messages')}>
              Back to Messages
            </Button>
          </>
        )}

        {status === 'already_member' && (
          <>
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Already a Member</h1>
            <p className="text-slate-400">
              You're already a member of this group. Go ahead and join the conversation!
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate(`/groups/${groupId}`)}
              >
                View Group
              </Button>
              <Button 
                className="flex-1"
                onClick={() => navigate(`/groups/${groupId}/chat`)}
              >
                <Users className="w-4 h-4 mr-2" />
                Open Chat
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Group Link Invalid</h1>
            <p className="text-slate-400">
              {errorMessage || 'This group link is invalid or has been revoked.'}
            </p>
            <Button onClick={() => navigate('/messages')} className="w-full">
              Go to Messages
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupJoin;
