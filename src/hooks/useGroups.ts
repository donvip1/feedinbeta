import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Group {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  is_private: boolean;
  requires_subscription: boolean;
  member_count: number;
  post_count: number;
}

export const useGroups = (userId?: string) => {
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadGroups = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('member_count', { ascending: false });

      if (groupsError) throw groupsError;

      const { data: memberships, error: membershipsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (membershipsError) throw membershipsError;

      const myGroupIds = memberships?.map(m => m.group_id) || [];
      setMyGroups(groups?.filter(g => myGroupIds.includes(g.id)) || []);
      setAllGroups(groups?.filter(g => !myGroupIds.includes(g.id)) || []);
    } catch (error: any) {
      console.error('Error loading groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load groups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    allGroups,
    myGroups,
    loading,
    refreshGroups: loadGroups,
  };
};
