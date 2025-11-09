import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_GROUPS = [
  { name: 'Flirt', description: 'Connect and flirt with others', is_private: false, is_premium: false, category: 'social' },
  { name: 'Romance', description: 'Share romantic moments and stories', is_private: false, is_premium: false, category: 'social' },
  { name: 'Advice', description: 'Get and give advice on various topics', is_private: false, is_premium: false, category: 'support' },
  { name: 'Education', description: 'Learn and share knowledge', is_private: false, is_premium: false, category: 'learning' },
  { name: 'Religion', description: 'Discuss faith and spirituality', is_private: false, is_premium: false, category: 'lifestyle' },
  { name: 'Movies', description: 'Talk about your favorite films and shows', is_private: false, is_premium: false, category: 'entertainment' },
  { name: 'Crypto Airdrops', description: 'Share crypto opportunities and airdrops', is_private: false, is_premium: false, category: 'finance' },
  { name: 'Adult 18+', description: 'Mature content for adults only (Premium)', is_private: true, is_premium: true, category: 'adult' },
  { name: 'International', description: 'Connect with users worldwide (Premium)', is_private: false, is_premium: true, category: 'global' },
];

const InitializeGroups = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkExistingGroups();
  }, [user]);

  const checkExistingGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .in('name', DEFAULT_GROUPS.map(g => g.name));

      if (error) throw error;
      setExistingGroups(data?.map(g => g.name) || []);
      setInitialized(data?.length === DEFAULT_GROUPS.length);
    } catch (error) {
      console.error('Error checking groups:', error);
    }
  };

  const initializeGroups = async () => {
    setLoading(true);
    try {
      const groupsToCreate = DEFAULT_GROUPS.filter(
        g => !existingGroups.includes(g.name)
      ).map(group => ({
        ...group,
        created_by: user?.id,
      }));

      if (groupsToCreate.length === 0) {
        toast.success('All default groups already exist!');
        setInitialized(true);
        return;
      }

      const { error } = await supabase.from('groups').insert(groupsToCreate);

      if (error) throw error;

      toast.success(`Created ${groupsToCreate.length} default groups!`);
      setInitialized(true);
      checkExistingGroups();
    } catch (error: any) {
      console.error('Error creating groups:', error);
      toast.error(error.message || 'Failed to create groups');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Initialize Default Groups</CardTitle>
          <CardDescription>
            Set up the default community groups for FEEDIN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {DEFAULT_GROUPS.map((group) => (
              <div
                key={group.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <div className="font-medium">{group.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {group.description}
                  </div>
                </div>
                {existingGroups.includes(group.name) && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
              </div>
            ))}
          </div>

          {initialized ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-500">
                <Check className="w-5 h-5" />
                <span className="font-medium">All groups initialized!</span>
              </div>
              <Button onClick={() => navigate('/groups')} className="w-full">
                Go to Groups
              </Button>
            </div>
          ) : (
            <Button
              onClick={initializeGroups}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Groups...
                </>
              ) : (
                'Initialize Default Groups'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InitializeGroups;
