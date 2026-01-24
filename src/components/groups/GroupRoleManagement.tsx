import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Crown, Shield, ShieldCheck, User, ChevronRight, 
  UserMinus, Check, X, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  user_id: string;
  role: string;
  profile: {
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  };
}

interface GroupRoleManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  groupId: string;
  currentUserRole: string;
  onRoleChanged: () => void;
}

const ROLE_CONFIG = {
  owner: {
    label: 'Owner',
    icon: Crown,
    color: 'text-yellow-500',
    description: 'Full control over the group',
  },
  admin: {
    label: 'Admin',
    icon: ShieldCheck,
    color: 'text-blue-500',
    description: 'Can manage members, links, and settings',
  },
  moderator: {
    label: 'Moderator',
    icon: Shield,
    color: 'text-green-500',
    description: 'Can manage messages and mute members',
  },
  member: {
    label: 'Member',
    icon: User,
    color: 'text-slate-400',
    description: 'Regular group member',
  },
};

export const GroupRoleManagement = ({
  open,
  onOpenChange,
  member,
  groupId,
  currentUserRole,
  onRoleChanged,
}: GroupRoleManagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const canAssignRole = (targetRole: string): boolean => {
    // Only owner and admin can assign roles
    if (!['owner', 'admin'].includes(currentUserRole)) return false;
    
    // Can't change your own role
    if (member?.user_id === user?.id) return false;
    
    // Owner can assign any role except owner (transfer ownership is separate)
    if (currentUserRole === 'owner') {
      return targetRole !== 'owner';
    }
    
    // Admin can only assign moderator or member roles
    if (currentUserRole === 'admin') {
      return ['moderator', 'member'].includes(targetRole);
    }
    
    return false;
  };

  const handleRoleChange = async (newRole: string) => {
    if (!member || !canAssignRole(newRole)) return;
    
    setLoading(true);
    setSelectedRole(newRole);
    
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: `${member.profile.username} is now a ${ROLE_CONFIG[newRole as keyof typeof ROLE_CONFIG].label}`,
      });
      
      onRoleChanged();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setSelectedRole(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!member) return;
    
    // Can't remove owner
    if (member.role === 'owner') {
      toast({
        title: 'Cannot remove owner',
        description: 'Transfer ownership first before removing',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Member removed',
        description: `${member.profile.username} has been removed from the group`,
      });
      
      onRoleChanged();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  const roleConfig = ROLE_CONFIG[member.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.member;
  const RoleIcon = roleConfig.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl bg-slate-900 border-slate-800 p-0">
        <SheetHeader className="p-4 border-b border-slate-800">
          <SheetTitle className="text-white">Manage Member</SheetTitle>
        </SheetHeader>

        <ScrollArea className="max-h-[calc(80vh-80px)]">
          <div className="p-4 space-y-6 pb-20">
            {/* Member Info */}
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
              <Avatar className="w-12 h-12">
                <AvatarImage src={member.profile.avatar_url || undefined} />
                <AvatarFallback>{member.profile.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-white">{member.profile.full_name || member.profile.username}</p>
                <p className="text-sm text-slate-400">@{member.profile.username}</p>
              </div>
              <div className={cn("flex items-center gap-1", roleConfig.color)}>
                <RoleIcon className="w-4 h-4" />
                <span className="text-sm">{roleConfig.label}</span>
              </div>
            </div>

            {/* Role Selection */}
            {['owner', 'admin'].includes(currentUserRole) && member.user_id !== user?.id && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-300">Change Role</h3>
                
                {Object.entries(ROLE_CONFIG)
                  .filter(([role]) => role !== 'owner') // Owner role is not assignable this way
                  .map(([role, config]) => {
                    const Icon = config.icon;
                    const isCurrentRole = member.role === role;
                    const canAssign = canAssignRole(role);
                    
                    return (
                      <button
                        key={role}
                        onClick={() => canAssign && handleRoleChange(role)}
                        disabled={!canAssign || loading || isCurrentRole}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                          isCurrentRole 
                            ? "bg-primary/10 border border-primary" 
                            : canAssign 
                              ? "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
                              : "bg-slate-800/30 opacity-50 cursor-not-allowed border border-transparent"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", config.color)} />
                        <div className="flex-1 text-left">
                          <p className="font-medium text-white">{config.label}</p>
                          <p className="text-xs text-slate-400">{config.description}</p>
                        </div>
                        {isCurrentRole && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                        {loading && selectedRole === role && (
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        )}
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Remove Member */}
            {['owner', 'admin'].includes(currentUserRole) && 
             member.role !== 'owner' && 
             member.user_id !== user?.id && (
              <div className="pt-4 border-t border-slate-800">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleRemoveMember}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <UserMinus className="w-4 h-4 mr-2" />
                  )}
                  Remove from Group
                </Button>
              </div>
            )}

            {/* Info for non-admins */}
            {!['owner', 'admin'].includes(currentUserRole) && (
              <div className="text-center py-4 text-slate-500 text-sm">
                Only admins can manage member roles
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default GroupRoleManagement;