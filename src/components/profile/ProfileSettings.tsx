import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  Camera, 
  Save, 
  User, 
  Bell, 
  Lock, 
  Shield,
  Wallet,
  TrendingUp,
  Bookmark,
  UsersRound,
  Layers,
  LogOut,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettings = ({ isOpen, onClose }: ProfileSettingsProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'menu' | 'edit-profile'>('menu');
  const [canChangeUsername, setCanChangeUsername] = useState(false);
  
  const [profile, setProfile] = useState({
    display_name: '',
    username: '',
    bio: '',
    avatar_url: '',
    status: '',
    about: '',
    purpose: '',
    marital_status: '',
  });

  useEffect(() => {
    if (isOpen && user) {
      loadProfile();
      checkUsernameChange();
    }
  }, [isOpen, user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          display_name: data.display_name || '',
          username: data.username || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          status: data.status || '',
          about: data.about || '',
          purpose: data.purpose || '',
          marital_status: data.marital_status || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const checkUsernameChange = async () => {
    try {
      const { data, error } = await supabase.rpc('can_change_username', {
        user_id: user?.id
      });
      
      if (error) throw error;
      setCanChangeUsername(data || false);
    } catch (error) {
      console.error('Error checking username change:', error);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const updates: any = {
        display_name: profile.display_name,
        bio: profile.bio,
        status: profile.status,
        status_updated_at: profile.status ? new Date().toISOString() : null,
        about: profile.about,
        purpose: profile.purpose,
        marital_status: profile.marital_status || null,
      };

      // Only include username if it can be changed
      if (canChangeUsername && profile.username !== '') {
        updates.username = profile.username.toLowerCase();
        updates.last_username_change = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Profile updated successfully',
      });
      
      setActiveSection('menu');
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast({
        title: 'Profile picture updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading image',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const settingsMenu = [
    { icon: Bell, title: 'Notifications', route: '/settings/notifications', color: 'text-pink-500' },
    { icon: Lock, title: 'Privacy Settings', route: '/settings/privacy', color: 'text-purple-500' },
    { icon: Shield, title: 'Blocked Users', route: '/settings/blocked', color: 'text-red-500' },
    { icon: TrendingUp, title: 'Trending', route: '/trending', color: 'text-orange-500' },
    { icon: UsersRound, title: 'Groups', route: '/groups', color: 'text-green-500' },
    { icon: Bookmark, title: 'Saved Posts', route: '/saved', color: 'text-blue-500' },
    { icon: Wallet, title: 'Wallet & Credits', route: '/wallet', color: 'text-yellow-500' },
    { icon: Layers, title: 'P2P Marketplace', route: '/p2p-marketplace', color: 'text-cyan-500' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div 
        className="absolute right-0 top-0 h-full w-full max-w-md bg-black border-l border-gray-800 animate-in slide-in-from-right duration-300 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {activeSection === 'edit-profile' ? 'Edit Profile' : 'Settings'}
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeSection === 'menu' && (
            <div className="space-y-4">
              {/* Edit Profile Button */}
              <Card className="bg-gray-900 border-gray-800">
                <button
                  onClick={() => setActiveSection('edit-profile')}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <User className="w-6 h-6 text-blue-500" />
                    <div className="text-left">
                      <h3 className="font-semibold">Edit Profile</h3>
                      <p className="text-sm text-gray-400">Update your personal information</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </Card>

              <Separator className="bg-gray-800" />

              {/* Settings Menu */}
              <div className="space-y-2">
                {settingsMenu.map((item) => (
                  <Card key={item.route} className="bg-gray-900 border-gray-800">
                    <button
                      onClick={() => {
                        navigate(item.route);
                        onClose();
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon className={`w-6 h-6 ${item.color}`} />
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </Card>
                ))}
              </div>

              <Separator className="bg-gray-800 my-6" />

              {/* Sign Out */}
              <Button
                onClick={signOut}
                variant="outline"
                className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}

          {activeSection === 'edit-profile' && (
            <div className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-2xl">
                    {profile.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center space-x-2 text-blue-500 hover:text-blue-400">
                    <Camera className="w-4 h-4" />
                    <span>Change Profile Picture</span>
                  </div>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </Label>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder="Your display name"
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Username</Label>
                  {!canChangeUsername && (
                    <span className="text-xs text-amber-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Can change in 2 months
                    </span>
                  )}
                </div>
                <Input
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase() })}
                  placeholder="username (lowercase only)"
                  disabled={!canChangeUsername}
                  className={!canChangeUsername ? 'opacity-60' : ''}
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself"
                  rows={3}
                />
              </div>

              {/* Status (Friends Only) */}
              <div className="space-y-2">
                <Label>Status (Visible to friends only)</Label>
                <Input
                  value={profile.status}
                  onChange={(e) => setProfile({ ...profile, status: e.target.value })}
                  placeholder="What's on your mind?"
                />
              </div>

              {/* About */}
              <div className="space-y-2">
                <Label>About (Public)</Label>
                <Textarea
                  value={profile.about}
                  onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                  placeholder="About you..."
                  rows={3}
                />
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label>Purpose on Platform (Public)</Label>
                <Input
                  value={profile.purpose}
                  onChange={(e) => setProfile({ ...profile, purpose: e.target.value })}
                  placeholder="Why are you here?"
                />
              </div>

              {/* Marital Status */}
              <div className="space-y-2">
                <Label>Marital Status (Public)</Label>
                <Select
                  value={profile.marital_status}
                  onValueChange={(value) => setProfile({ ...profile, marital_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={() => setActiveSection('menu')}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-blue-500"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
