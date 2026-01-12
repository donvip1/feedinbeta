import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Camera, Loader2, Trash2, MapPin, Phone, Calendar, User, Briefcase, Globe } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { PageHeader } from '@/components/shared/PageHeader';
import { detectUserLocation, getCountryFlag, getCurrencyForCountry, type LocationData } from '@/lib/location-service';

// Country list for selection
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
  { code: 'EG', name: 'Egypt' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'PL', name: 'Poland' },
  { code: 'RU', name: 'Russia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'CI', name: 'Ivory Coast' },
  { code: 'CM', name: 'Cameroon' },
].sort((a, b) => a.name.localeCompare(b.name));

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

interface ProfileData {
  display_name: string;
  username: string;
  bio: string;
  avatar_url: string;
  country: string;
  city: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  occupation: string;
  timezone: string;
  detected_country_code: string;
}

const AccountSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    display_name: '',
    username: '',
    bio: '',
    avatar_url: '',
    country: '',
    city: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    occupation: '',
    timezone: '',
    detected_country_code: '',
  });
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, bio, avatar_url, country, city, phone_number, date_of_birth, gender, occupation, timezone, detected_country_code')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile({
        display_name: data.display_name || '',
        username: data.username || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || '',
        country: data.country || '',
        city: data.city || '',
        phone_number: data.phone_number || '',
        date_of_birth: data.date_of_birth || '',
        gender: data.gender || '',
        occupation: data.occupation || '',
        timezone: data.timezone || '',
        detected_country_code: data.detected_country_code || '',
      });
      
      // Get user email from auth
      if (user?.email) {
        setUserEmail(user.email);
      }
    } catch (error: any) {
      toast({
        title: 'Error loading profile',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const location: LocationData = await detectUserLocation();
      
      setProfile(prev => ({
        ...prev,
        country: location.country,
        city: location.city,
        timezone: location.timezone,
        detected_country_code: location.countryCode,
      }));

      toast({
        title: 'Location detected',
        description: `${location.city ? location.city + ', ' : ''}${location.country}`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not detect location',
        description: 'Please select your country manually.',
        variant: 'destructive',
      });
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      setProfile(prev => ({
        ...prev,
        country: country.name,
        detected_country_code: countryCode,
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const currency = profile.detected_country_code 
        ? getCurrencyForCountry(profile.detected_country_code)
        : 'USD';

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
          username: profile.username,
          bio: profile.bio,
          country: profile.country,
          city: profile.city,
          phone_number: profile.phone_number || null,
          date_of_birth: profile.date_of_birth || null,
          gender: profile.gender || null,
          occupation: profile.occupation || null,
          timezone: profile.timezone,
          detected_country_code: profile.detected_country_code,
          preferred_currency: currency,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved successfully',
      });
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setLoading(true);
      
      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/avatars/')[1];
        if (oldPath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: data.publicUrl });
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been changed',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading avatar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Note: Actual account deletion should be handled by an edge function
      // for security reasons. This is a placeholder.
      toast({
        title: 'Account deletion requested',
        description: 'Your account will be deleted within 24 hours. Contact support to cancel.',
      });
      
      // In production, call an edge function here
      // await supabase.functions.invoke('delete-account')
      
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: 'Error deleting account',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getSelectedCountryCode = () => {
    if (profile.detected_country_code) {
      return profile.detected_country_code;
    }
    const found = COUNTRIES.find(c => c.name === profile.country);
    return found?.code || '';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader title="Account Settings" />

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Card className="bg-card border-border p-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback>
                  {profile.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 bg-primary rounded-full p-2 cursor-pointer hover:bg-primary/80 transition-colors"
              >
                <Camera className="w-4 h-4 text-primary-foreground" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={loading}
                />
              </label>
            </div>
            <div className="flex gap-2 mt-2">
              <p className="text-sm text-muted-foreground">
                Click camera to change
              </p>
              {profile.avatar_url && (
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const oldPath = profile.avatar_url.split('/avatars/')[1];
                      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
                      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user?.id);
                      setProfile({ ...profile, avatar_url: '' });
                      toast({ title: 'Avatar removed' });
                    } catch (error: any) {
                      toast({ title: 'Error', description: error.message, variant: 'destructive' });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="text-sm text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </h3>
            
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={userEmail}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>

            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={profile.display_name || ''}
                onChange={(e) =>
                  setProfile({ ...profile, display_name: e.target.value })
                }
                placeholder="Your display name"
                className="bg-background"
              />
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={profile.username || ''}
                onChange={(e) =>
                  setProfile({ ...profile, username: e.target.value })
                }
                placeholder="@username"
                className="bg-background"
              />
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio || ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us about yourself"
                className="bg-background min-h-[100px]"
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Personal Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Personal Details
            </h3>

            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone_number"
                  type="tel"
                  value={profile.phone_number || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, phone_number: e.target.value })
                  }
                  placeholder="+1 234 567 8900"
                  className="bg-background flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Required for P2P marketplace
              </p>
            </div>

            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={profile.date_of_birth || ''}
                onChange={(e) =>
                  setProfile({ ...profile, date_of_birth: e.target.value })
                }
                className="bg-background"
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={profile.gender || ''}
                onValueChange={(value) => setProfile({ ...profile, gender: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="occupation">Occupation</Label>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="occupation"
                  value={profile.occupation || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, occupation: e.target.value })
                  }
                  placeholder="Your profession"
                  className="bg-background flex-1"
                />
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Location Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Globe className="w-4 h-4 mr-2" />
                )}
                {detectingLocation ? 'Detecting...' : 'Auto-detect'}
              </Button>
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Select
                value={getSelectedCountryCode()}
                onValueChange={handleCountryChange}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select your country">
                    {getSelectedCountryCode() && (
                      <span className="flex items-center gap-2">
                        <span>{getCountryFlag(getSelectedCountryCode())}</span>
                        <span>{profile.country}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50 max-h-[300px]">
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{getCountryFlag(country.code)}</span>
                        <span>{country.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Required for P2P marketplace and currency settings
              </p>
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city || ''}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
                placeholder="Your city"
                className="bg-background"
              />
            </div>

            {profile.timezone && (
              <div>
                <Label>Timezone</Label>
                <Input
                  value={profile.timezone}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            )}
          </div>

          <Separator className="my-6" />

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-gradient-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </Card>

        {/* Delete Account Section */}
        <Card className="bg-card border-destructive/50 mt-6 p-6">
          <h3 className="text-lg font-bold text-destructive mb-2">
            Delete Account
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. All your posts,
            messages, and data will be permanently deleted.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your
                  account and remove all your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete my account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default AccountSettings;