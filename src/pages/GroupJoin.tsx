import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CheckCircle, XCircle, Lock } from 'lucide-react';

const GroupJoin = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_member'>('loading');
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
      const { data, error } = await supabase.rpc('join_group_via_invite', {
        p_invite_code: inviteCode,
      });

      if (error) throw error;

      const result = data as { success: boolean; group_id?: string; already_member?: boolean; error?: string };

      if (!result.success) {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to join group');
        return;
      }

      if (result.already_member) {
        setStatus('already_member');
        setGroupId(result.group_id || null);
        toast({
          title: 'Already a member',
          description: 'You are already a member of this group',
        });
      } else {
        setStatus('success');
        setGroupId(result.group_id || null);
        toast({
          title: 'Welcome!',
          description: 'You have successfully joined the group',
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
          <p className="text-slate-400">Joining group...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 text-center space-y-6">
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome to the Group!</h1>
            <p className="text-slate-400">
              You have successfully joined the group. Start chatting with other members now!
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
                Start Chatting
              </Button>
            </div>
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
            <h1 className="text-2xl font-bold text-white">Invite Link Invalid</h1>
            <p className="text-slate-400">
              {errorMessage || 'This invite link is invalid, expired, or has been revoked.'}
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
