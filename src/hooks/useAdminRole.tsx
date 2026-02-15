import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AdminPermissions {
  role: string | null;
  canManageP2P: boolean;
  canManageDisputes: boolean;
  canManageUsers: boolean;
  canManageContent: boolean;
  canViewAnalytics: boolean;
  canManageRoles: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isDeveloper: boolean;
  hasAnyAdminAccess: boolean;
}

export const useAdminRole = () => {
  const { user } = useAuth();

  const { data: permissions, isLoading, refetch } = useQuery({
    queryKey: ['admin-permissions', user?.id],
    queryFn: async (): Promise<AdminPermissions> => {
      if (!user?.id) {
        return {
          role: null,
          canManageP2P: false,
          canManageDisputes: false,
          canManageUsers: false,
          canManageContent: false,
          canViewAnalytics: false,
          canManageRoles: false,
          isAdmin: false,
          isModerator: false,
          isDeveloper: false,
          hasAnyAdminAccess: false,
        };
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .in('role', ['admin', 'moderator', 'developer', 'super_admin'])
        .maybeSingle();

      if (error || !data) {
        return {
          role: null,
          canManageP2P: false,
          canManageDisputes: false,
          canManageUsers: false,
          canManageContent: false,
          canViewAnalytics: false,
          canManageRoles: false,
          isAdmin: false,
          isModerator: false,
          isDeveloper: false,
          hasAnyAdminAccess: false,
        };
      }

      const roleData = data as any;
      const isSuperAdmin = roleData.role === 'super_admin';
      const isAdmin = roleData.role === 'admin' || isSuperAdmin;
      const isModerator = roleData.role === 'moderator';
      const isDeveloper = roleData.role === 'developer' || isSuperAdmin;

      // Developers have all permissions
      const canManageP2P = isDeveloper || isAdmin || roleData.can_manage_p2p === true;
      const canManageDisputes = isDeveloper || isAdmin || roleData.can_manage_disputes === true;
      const canManageUsers = isDeveloper || isAdmin || roleData.can_manage_users === true;
      const canManageContent = isDeveloper || isAdmin || roleData.can_manage_content === true;
      const canViewAnalytics = isDeveloper || isAdmin || roleData.can_view_analytics === true;
      const canManageRoles = isDeveloper || roleData.can_manage_roles === true;

      return {
        role: roleData.role,
        canManageP2P,
        canManageDisputes,
        canManageUsers,
        canManageContent,
        canViewAnalytics,
        canManageRoles,
        isAdmin,
        isModerator,
        isDeveloper,
        hasAnyAdminAccess: canManageP2P || canManageDisputes || canManageUsers || canManageContent || canViewAnalytics,
      };
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  return {
    permissions: permissions ?? {
      role: null,
      canManageP2P: false,
      canManageDisputes: false,
      canManageUsers: false,
      canManageContent: false,
      canViewAnalytics: false,
      canManageRoles: false,
      isAdmin: false,
      isModerator: false,
      isDeveloper: false,
      hasAnyAdminAccess: false,
    },
    isLoading,
    refetch,
  };
};
