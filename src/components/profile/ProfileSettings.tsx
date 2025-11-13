import { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  MapPin,
  Calendar,
  Heart,
  Users,
  Briefcase,
  Sparkles,
  Gamepad,
  GraduationCap,
  Mic,
  Palette,
  Smile,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Youtube,
  Link as LinkIcon
} from 'lucide-react';

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "NG", name: "Nigeria" },
  { code: "IN", name: "India" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "RU", name: "Russia" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "KE", name: "Kenya" },
  { code: "GH", name: "Ghana" },
  { code: "KR", name: "South Korea" },
  { code: "ES", name: "Spain" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "TR", name: "Turkey" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "TH", name: "Thailand" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "UA", name: "Ukraine" },
].sort((a, b) => a.name.localeCompare(b.name));

const PURPOSE_OPTIONS = [
  { value: "friends", label: "Make friends", icon: Users },
  { value: "dating", label: "Dating", icon: Heart },
  { value: "networking", label: "Networking", icon: Briefcase },
  { value: "business", label: "Business", icon: Sparkles },
  { value: "gaming", label: "Gaming", icon: Gamepad },
  { value: "learning", label: "Learning", icon: GraduationCap },
  { value: "content", label: "Find content", icon: Palette },
  { value: "streaming", label: "Live streaming", icon: Mic },
  { value: "browsing", label: "Just browsing", icon: Smile },
];

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function SearchableCountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCountries = useMemo(
    () => COUNTRIES.filter((country) => country.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm]
  );

  const selectedCountry = COUNTRIES.find((c) => c.code === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 pl-12 pr-10 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center">
          <MapPin size={18} className="text-gray-500 absolute left-4" />
          <span className={selectedCountry ? "text-white" : "text-gray-500"}>
            {selectedCountry ? selectedCountry.name : "Select your country"}
          </span>
        </div>
        <ChevronRight size={18} className={`text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 max-h-60 flex flex-col">
          <div className="relative m-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-gray-900 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <div
                  key={country.code}
                  onClick={() => {
                    onChange(country.code);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className="p-3 text-white hover:bg-blue-600 rounded-lg cursor-pointer"
                >
                  {country.name}
                </div>
              ))
            ) : (
              <div className="p-3 text-gray-500 text-center">No countries found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
    age: '',
    country: '',
    instagram_url: '',
    twitter_url: '',
    linkedin_url: '',
    facebook_url: '',
    tiktok_url: '',
    youtube_url: '',
    website_url: '',
  });
  
  const [usernameStatus, setUsernameStatus] = useState({
    loading: false,
    available: true,
    message: '',
    originalUsername: '',
  });
  
  const debouncedUsername = useDebounce(profile.username, 500);

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
        const profileData = data as any;
        setProfile({
          display_name: profileData.display_name || '',
          username: profileData.username || '',
          bio: profileData.bio || '',
          avatar_url: profileData.avatar_url || '',
          status: profileData.status || '',
          about: profileData.about || '',
          purpose: profileData.purpose || '',
          marital_status: profileData.marital_status || '',
          age: profileData.age?.toString() || '',
          country: profileData.country || '',
          instagram_url: profileData.instagram_url || '',
          twitter_url: profileData.twitter_url || '',
          linkedin_url: profileData.linkedin_url || '',
          facebook_url: profileData.facebook_url || '',
          tiktok_url: profileData.tiktok_url || '',
          youtube_url: profileData.youtube_url || '',
          website_url: profileData.website_url || '',
        });
        setUsernameStatus(prev => ({ ...prev, originalUsername: data.username || '' }));
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  useEffect(() => {
    if (!debouncedUsername || debouncedUsername.length < 3) {
      setUsernameStatus(prev => ({ ...prev, loading: false, available: true, message: '' }));
      return;
    }

    // Don't check if it's the original username
    if (debouncedUsername === usernameStatus.originalUsername) {
      setUsernameStatus(prev => ({ ...prev, loading: false, available: true, message: '' }));
      return;
    }

    setUsernameStatus(prev => ({ ...prev, loading: true }));

    checkUsernameAvailability(debouncedUsername);
  }, [debouncedUsername]);

  const checkUsernameAvailability = async (username: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setUsernameStatus({
          loading: false,
          available: false,
          message: 'Username is taken',
          originalUsername: usernameStatus.originalUsername,
        });
      } else {
        setUsernameStatus({
          loading: false,
          available: true,
          message: 'Username is available!',
          originalUsername: usernameStatus.originalUsername,
        });
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameStatus(prev => ({ ...prev, loading: false }));
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
    if (!usernameStatus.available && profile.username !== usernameStatus.originalUsername) {
      toast({
        title: 'Username not available',
        description: 'Please choose a different username',
        variant: 'destructive',
      });
      return;
    }

    if (profile.age && (parseInt(profile.age) < 13 || parseInt(profile.age) > 120)) {
      toast({
        title: 'Invalid age',
        description: 'Age must be between 13 and 120',
        variant: 'destructive',
      });
      return;
    }

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
        age: profile.age ? parseInt(profile.age) : null,
        country: profile.country || null,
        instagram_url: profile.instagram_url || null,
        twitter_url: profile.twitter_url || null,
        linkedin_url: profile.linkedin_url || null,
        facebook_url: profile.facebook_url || null,
        tiktok_url: profile.tiktok_url || null,
        youtube_url: profile.youtube_url || null,
        website_url: profile.website_url || null,
      };

      // Only include username if it can be changed and is different
      if (canChangeUsername && profile.username !== usernameStatus.originalUsername && profile.username !== '') {
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
      loadProfile(); // Reload to get updated data
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
                <div className="relative">
                  <Input
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase() })}
                    placeholder="username (lowercase only)"
                    disabled={!canChangeUsername}
                    className={!canChangeUsername ? 'opacity-60' : ''}
                  />
                  {canChangeUsername && profile.username !== usernameStatus.originalUsername && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      {usernameStatus.loading && <Loader2 size={18} className="text-blue-400 animate-spin" />}
                      {!usernameStatus.loading && usernameStatus.message && usernameStatus.available && (
                        <CheckCircle size={18} className="text-green-500" />
                      )}
                      {!usernameStatus.loading && usernameStatus.message && !usernameStatus.available && (
                        <XCircle size={18} className="text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {canChangeUsername && usernameStatus.message && profile.username !== usernameStatus.originalUsername && (
                  <p className={`text-xs ${usernameStatus.available ? 'text-green-500' : 'text-red-500'}`}>
                    {usernameStatus.message}
                  </p>
                )}
              </div>

              {/* Age */}
              <div className="space-y-2">
                <Label>Age</Label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <Input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                    placeholder="Your age"
                    min="13"
                    max="120"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Country */}
              <div className="space-y-2">
                <Label>Country</Label>
                <SearchableCountrySelect
                  value={profile.country}
                  onChange={(code) => setProfile({ ...profile, country: code })}
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
                <div className="grid grid-cols-2 gap-2">
                  {PURPOSE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setProfile({ ...profile, purpose: opt.value })}
                        className={`flex items-center p-3 rounded-lg transition-all ${
                          profile.purpose === opt.value
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <Icon size={16} className="mr-2" />
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
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

              <Separator className="my-6" />

              {/* Social Media Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Social Media Links
                </h3>

                <div className="space-y-3">
                  {/* Instagram */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-pink-500" />
                      Instagram
                    </Label>
                    <Input
                      value={profile.instagram_url}
                      onChange={(e) => setProfile({ ...profile, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/username"
                      type="url"
                    />
                  </div>

                  {/* Twitter/X */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Twitter className="w-4 h-4 text-blue-400" />
                      Twitter / X
                    </Label>
                    <Input
                      value={profile.twitter_url}
                      onChange={(e) => setProfile({ ...profile, twitter_url: e.target.value })}
                      placeholder="https://twitter.com/username"
                      type="url"
                    />
                  </div>

                  {/* LinkedIn */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-blue-600" />
                      LinkedIn
                    </Label>
                    <Input
                      value={profile.linkedin_url}
                      onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                      type="url"
                    />
                  </div>

                  {/* Facebook */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Facebook className="w-4 h-4 text-blue-500" />
                      Facebook
                    </Label>
                    <Input
                      value={profile.facebook_url}
                      onChange={(e) => setProfile({ ...profile, facebook_url: e.target.value })}
                      placeholder="https://facebook.com/username"
                      type="url"
                    />
                  </div>

                  {/* TikTok */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mic className="w-4 h-4" />
                      TikTok
                    </Label>
                    <Input
                      value={profile.tiktok_url}
                      onChange={(e) => setProfile({ ...profile, tiktok_url: e.target.value })}
                      placeholder="https://tiktok.com/@username"
                      type="url"
                    />
                  </div>

                  {/* YouTube */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      YouTube
                    </Label>
                    <Input
                      value={profile.youtube_url}
                      onChange={(e) => setProfile({ ...profile, youtube_url: e.target.value })}
                      placeholder="https://youtube.com/@channel"
                      type="url"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-primary" />
                      Website
                    </Label>
                    <Input
                      value={profile.website_url}
                      onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                      placeholder="https://yourwebsite.com"
                      type="url"
                    />
                  </div>
                </div>
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
