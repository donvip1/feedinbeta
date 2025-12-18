import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusVisibility, setStatusVisibility] = useState('public');
  const [about, setAbout] = useState('');
  const [aboutVisibility, setAboutVisibility] = useState('public');
  const [canChangeAbout, setCanChangeAbout] = useState(true);
  const [lastAboutChange, setLastAboutChange] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, status, status_visibility, about, about_visibility, about_updated_at')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setUsername(data.username);
        setStatus(data.status || '');
        setStatusVisibility(data.status_visibility || 'public');
        setAbout(data.about || '');
        setAboutVisibility(data.about_visibility || 'public');
        setLastAboutChange(data.about_updated_at);

        // Check if about can be changed (2 weeks = 14 days)
        if (data.about_updated_at) {
          const lastChange = new Date(data.about_updated_at);
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          setCanChangeAbout(lastChange < twoWeeksAgo);
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSave = async () => {
    if (status.length > 200) {
      toast({
        title: 'Status too long',
        description: 'Status must be 200 characters or less',
        variant: 'destructive',
      });
      return;
    }

    if (about.length > 150) {
      toast({
        title: 'About too long',
        description: 'About must be 150 characters or less',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const updates: any = {
        status,
        status_visibility: statusVisibility,
        status_updated_at: new Date().toISOString(),
      };

      // Only update about if it can be changed
      if (canChangeAbout) {
        updates.about = about;
        updates.about_visibility = aboutVisibility;
        updates.about_updated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your status and about have been saved',
      });

      navigate(`/profile/${username || user?.id}`);
    } catch (error: any) {
      toast({
        title: 'Error updating profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/50 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="ghost"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Status & About</h1>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card className="p-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status (max 200 characters)</Label>
            <Textarea
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 200))}
              placeholder="What's on your mind?"
              rows={3}
              maxLength={200}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {status.length}/200
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status Visibility</Label>
            <Select value={statusVisibility} onValueChange={setStatusVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="friends">Friends Only</SelectItem>
                <SelectItem value="followers">Followers Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* About */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>About (max 150 characters)</Label>
              {!canChangeAbout && (
                <span className="text-xs text-amber-500">
                  Can change in 2 weeks
                </span>
              )}
            </div>
            <Textarea
              value={about}
              onChange={(e) => setAbout(e.target.value.slice(0, 150))}
              placeholder="About you..."
              rows={3}
              maxLength={150}
              disabled={!canChangeAbout}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {about.length}/150
              </span>
            </div>
          </div>

          {canChangeAbout && (
            <div className="space-y-2">
              <Label>About Visibility</Label>
              <Select value={aboutVisibility} onValueChange={setAboutVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="friends">Friends Only</SelectItem>
                  <SelectItem value="followers">Followers Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default ProfileEdit;
