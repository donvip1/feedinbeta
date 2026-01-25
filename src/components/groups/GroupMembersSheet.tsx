import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useGroupPresence, getPresenceColor, formatLastSeen } from '@/hooks/useGroupPresence';
import {
  X, Search, UserPlus, UserCheck, MessageCircle, Clock, MoreVertical,
  Shield, Crown, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GroupRoleManagement } from './GroupRoleManagement';
import { PresenceStatus } from '@/hooks/usePresence';

interface GroupMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: Member[];
  isAdmin: boolean;
  currentUserRole?: string;
  onMembersChanged?: () => void;
}

interface Member {
  id?: string;
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  username?: string;
}

interface FriendStatus {
  [userId: string]: 'none' | 'pending' | 'friends';
}

export const GroupMembersSheet = ({
  open,
  onOpenChange,
  groupId,
  members,
  isAdmin,
  currentUserRole = 'member',
  onMembersChanged,
}: GroupMembersSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [friendStatuses, setFriendStatuses] = useState<FriendStatus>({});
  const [loadingFriend, setLoadingFriend] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRoleManagement, setShowRoleManagement] = useState(false);

  // Get member IDs for presence tracking
  const memberIds = useMemo(() => members.map(m => m.user_id), [members]);
  
  // Group presence hook
  const { onlineCount, getMemberStatus, isMemberOnline } = useGroupPresence({
    groupId,
    memberIds,
  });

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

      const { data: follows } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

      const { data: requests } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending');

      const statuses: FriendStatus = {};

      otherMemberIds.forEach(memberId => {
        const isFriend = follows?.some(f =>
          (f.follower_id === user.id && f.following_id === memberId) ||
          (f.following_id === user.id && f.follower_id === memberId)
        );

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
    navigate(`/messages?userId=${memberId}`);
    onOpenChange(false);
  };

  const filteredMembers = members.filter(m =>
    m.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: owners first, then admins, then regular members
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const roleOrder: Record<string, number> = { owner: 0, admin: 1, moderator: 2, member: 3 };
    return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
  });

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="w-3.5 h-3.5 text-yellow-400" />;
    if (role === 'admin') return <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />;
    if (role === 'moderator') return <Shield className="w-3.5 h-3.5 text-green-400" />;
    return null;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    if (role === 'moderator') return 'Mod';
    return null;
  };

  const handleMemberClick = (member: Member) => {
    if (['owner', 'admin'].includes(currentUserRole) && member.user_id !== user?.id) {
      setSelectedMember(member);
      setShowRoleManagement(true);
    }
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
              <SheetTitle className="text-white flex-1">
                {members.length} Members
                {onlineCount > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    · {onlineCount} online
                  </span>
                )}
              </SheetTitle>
            </div>
          </SheetHeader>

          {/* Search */}
          <div className="p-4 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Members List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {sortedMembers.map(member => {
                const isCurrentUser = member.user_id === user?.id;
                const friendStatus = friendStatuses[member.user_id];
                const roleIcon = getRoleIcon(member.role);
                const roleBadge = getRoleBadge(member.role);

                return (
                  <div
                    key={member.user_id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-colors",
                      ['owner', 'admin'].includes(currentUserRole) && member.user_id !== user?.id
                        ? "hover:bg-slate-800/50 cursor-pointer"
                        : "hover:bg-slate-800/50"
                    )}
                    onClick={() => handleMemberClick(member)}
                  >
                    {/* Avatar with online status dot */}
                    <div className="relative">
                      <Avatar
                        className="h-11 w-11 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${member.user_id}`);
                        }}
                      >
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-sm">
                          {member.display_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online status dot */}
                      <div className={cn(
                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900",
                        getPresenceColor(getMemberStatus(member.user_id) as PresenceStatus)
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium text-white truncate cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${member.user_id}`);
                          }}
                        >
                          {member.display_name || 'User'}
                          {isCurrentUser && ' (You)'}
                        </span>
                        {roleIcon}
                        {roleBadge && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            member.role === 'owner' ? "bg-yellow-500/20 text-yellow-400" : 
                            member.role === 'admin' ? "bg-blue-500/20 text-blue-400" :
                            "bg-green-500/20 text-green-400"
                          )}>
                            {roleBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {isCurrentUser ? 'You' : friendStatus === 'friends' ? 'Friend' : 
                          ['owner', 'admin'].includes(currentUserRole) ? 'Tap to manage' : 'Tap to view profile'}
                      </p>
                    </div>

                    {!isCurrentUser && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Friend Action */}
                        {friendStatus === 'friends' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-green-400"
                            disabled
                            title="Already friends"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        ) : friendStatus === 'pending' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-yellow-400"
                            disabled
                            title="Request pending"
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleSendFriendRequest(member.user_id)}
                            disabled={loadingFriend === member.user_id}
                            title="Add friend"
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Message - only if friends */}
                        {friendStatus === 'friends' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleOpenDM(member.user_id)}
                            title="Send message"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}

                        {/* More options for admins */}
                        {['owner', 'admin'].includes(currentUserRole) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-400 hover:text-white"
                            onClick={() => handleMemberClick(member)}
                            title="Manage member"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {sortedMembers.length === 0 && searchQuery && (
                <div className="text-center py-12 text-slate-500">
                  No members found matching "{searchQuery}"
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Privacy Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <p className="text-xs text-slate-500 text-center">
              {['owner', 'admin'].includes(currentUserRole) 
                ? 'Tap on a member to manage their role'
                : 'Send a friend request to chat privately with members'
              }
            </p>
          </div>
        </div>

        {/* Role Management Sheet */}
        <GroupRoleManagement
          open={showRoleManagement}
          onOpenChange={setShowRoleManagement}
          member={selectedMember ? {
            id: selectedMember.id || '',
            user_id: selectedMember.user_id,
            role: selectedMember.role,
            profile: {
              username: selectedMember.username || selectedMember.display_name || 'User',
              avatar_url: selectedMember.avatar_url,
              full_name: selectedMember.display_name,
            }
          } : null}
          groupId={groupId}
          currentUserRole={currentUserRole}
          onRoleChanged={() => {
            onMembersChanged?.();
            setShowRoleManagement(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
};

export default GroupMembersSheet;
