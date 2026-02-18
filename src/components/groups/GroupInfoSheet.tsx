import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  X, Users, Lock, Globe, Calendar, UserPlus, UserCheck, 
  MessageCircle, Clock, Image as ImageIcon, Link as LinkIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/profile/VerifiedBadge';

interface GroupInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  group: {
    id: string;
    name: string;
    avatar_url?: string | null;
    description?: string | null;
    is_private?: boolean;
    created_at?: string;
  };
  members: Member[];
  memberCount: number;
  isAdmin: boolean;
  isMember: boolean;
  onShowMembers: () => void;
}

interface Member {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface FriendStatus {
  [userId: string]: 'none' | 'pending' | 'friends';
}

export const GroupInfoSheet = ({
  open,
  onOpenChange,
  groupId,
  group,
  members,
  memberCount,
  isAdmin,
  isMember,
  onShowMembers,
}: GroupInfoSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [friendStatuses, setFriendStatuses] = useState<FriendStatus>({});
  const [loadingFriend, setLoadingFriend] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.id) {
      loadFriendStatuses();
    }
  }, [open, user?.id, members]);

  const loadFriendStatuses = async () => {
    if (!user?.id || members.length === 0) return;

    try {
      const otherMemberIds = members
        .filter(m => m.user_id !== user.id)
        .map(m => m.user_id);

      // Check existing friendships
      const { data: follows } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

      // Check pending friend requests
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending');

      const statuses: FriendStatus = {};

      otherMemberIds.forEach(memberId => {
        // Check if already friends (mutual follow or friend request accepted)
        const isFriend = follows?.some(f =>
          (f.follower_id === user.id && f.following_id === memberId) ||
          (f.following_id === user.id && f.follower_id === memberId)
        );

        // Check if request pending
        const hasPending = requests?.some(r =>
          (r.sender_id === user.id && r.receiver_id === memberId) ||
          (r.receiver_id === user.id && r.sender_id === memberId)
        );

        if (isFriend) {
          statuses[memberId] = 'friends';
        } else if (hasPending) {
          statuses[memberId] = 'pending';
        } else {
          statuses[memberId] = 'none';
        }
      });

      setFriendStatuses(statuses);
    } catch (error) {
      console.error('Error loading friend statuses:', error);
    }
  };

  const handleSendFriendRequest = async (memberId: string) => {
    if (!user?.id) return;
    setLoadingFriend(memberId);

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: memberId,
          status: 'pending',
        });

      if (error) throw error;

      setFriendStatuses(prev => ({ ...prev, [memberId]: 'pending' }));
      toast({ title: 'Friend request sent!' });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Request already sent' });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to send request',
          variant: 'destructive',
        });
      }
    } finally {
      setLoadingFriend(null);
    }
  };

  const handleOpenDM = (memberId: string) => {
    // Navigate to DM with this user
    navigate(`/messages?userId=${memberId}`);
    onOpenChange(false);
  };

  const adminMembers = members.filter(m => m.role === 'admin' || m.role === 'owner');
  const regularMembers = members.filter(m => m.role !== 'admin' && m.role !== 'owner');

  const MemberItem = ({ member }: { member: Member }) => {
    const isCurrentUser = member.user_id === user?.id;
    const friendStatus = friendStatuses[member.user_id];

    return (
      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors">
        <Avatar 
          className="h-11 w-11 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate(`/profile/${member.user_id}`)}
        >
          <AvatarImage src={member.avatar_url || ''} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-sm">
            {member.display_name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span 
              className="font-medium text-white truncate cursor-pointer hover:underline flex items-center gap-1"
              onClick={() => navigate(`/profile/${member.user_id}`)}
            >
              {member.display_name || 'User'}
              {isCurrentUser && ' (You)'}
              <VerifiedBadge userId={member.user_id} size="sm" />
            </span>
            {(member.role === 'admin' || member.role === 'owner') && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                {member.role === 'owner' ? 'Owner' : 'Admin'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">
            {isCurrentUser ? 'Tap to view profile' : 'Member'}
          </p>
        </div>

        {!isCurrentUser && (
          <div className="flex items-center gap-1">
            {/* Friend Action */}
            {friendStatus === 'friends' ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-400"
                disabled
              >
                <UserCheck className="w-4 h-4" />
              </Button>
            ) : friendStatus === 'pending' ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-yellow-400"
                disabled
              >
                <Clock className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-primary"
                onClick={() => handleSendFriendRequest(member.user_id)}
                disabled={loadingFriend === member.user_id}
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            )}

            {/* Message - only if friends */}
            {friendStatus === 'friends' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-primary"
                onClick={() => handleOpenDM(member.user_id)}
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-slate-900 border-slate-800 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-5 h-5" />
              </Button>
              <SheetTitle className="text-white">Group Info</SheetTitle>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {/* Group Profile */}
            <div className="p-6 text-center border-b border-slate-800">
              <img
                src={group.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=6366f1&color=fff&size=128`}
                className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-slate-700"
                alt={group.name}
              />
              <h2 className="text-xl font-bold text-white mb-1">{group.name}</h2>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-3">
                {group.is_private ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Private Group
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    Public Group
                  </>
                )}
                <span>•</span>
                <Users className="w-3.5 h-3.5" />
                {memberCount} members
              </div>
              {group.description && (
                <p className="text-sm text-slate-300 max-w-xs mx-auto">{group.description}</p>
              )}
              {group.created_at && (
                <p className="text-xs text-slate-500 mt-3">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Created {format(new Date(group.created_at), 'MMMM d, yyyy')}
                </p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-px bg-slate-800 border-b border-slate-800">
              <button className="p-4 bg-slate-900 hover:bg-slate-800/50 transition-colors text-center">
                <ImageIcon className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <span className="text-xs text-slate-500">Media</span>
              </button>
              <button className="p-4 bg-slate-900 hover:bg-slate-800/50 transition-colors text-center">
                <LinkIcon className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <span className="text-xs text-slate-500">Links</span>
              </button>
              <button 
                className="p-4 bg-slate-900 hover:bg-slate-800/50 transition-colors text-center"
                onClick={onShowMembers}
              >
                <Users className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <span className="text-xs text-slate-500">Members</span>
              </button>
            </div>

            {/* Members List */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">
                  {memberCount} Members
                </h3>
                {memberCount > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary text-xs"
                    onClick={onShowMembers}
                  >
                    View All
                  </Button>
                )}
              </div>

              {/* Admins */}
              {adminMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Admins</p>
                  <div className="space-y-1">
                    {adminMembers.slice(0, 3).map(member => (
                      <MemberItem key={member.user_id} member={member} />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Members */}
              {regularMembers.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Members</p>
                  <div className="space-y-1">
                    {regularMembers.slice(0, 7).map(member => (
                      <MemberItem key={member.user_id} member={member} />
                    ))}
                    {regularMembers.length > 7 && (
                      <Button
                        variant="ghost"
                        className="w-full text-slate-400 hover:text-white"
                        onClick={onShowMembers}
                      >
                        View all {regularMembers.length} members
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Privacy Note */}
              <div className="mt-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <p className="text-xs text-slate-400">
                  <UserPlus className="w-3 h-3 inline mr-1" />
                  To chat privately with a member, send them a friend request first. 
                  They must accept before you can message them.
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GroupInfoSheet;
