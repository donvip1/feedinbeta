import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Camera, Loader2, MapPin, Phone, Calendar, User, Briefcase, Globe, Check, ChevronsUpDown, Lock, HelpCircle } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { PageHeader } from '@/components/shared/PageHeader';
import { detectUserLocation, getCountryFlag, getCurrencyForCountry, type LocationData } from '@/lib/location-service';
import { COUNTRIES, OCCUPATION_OPTIONS, getCitiesForCountry, getDialCodeForCountry, getCountryByCode } from '@/lib/country-data';
import { cn } from '@/lib/utils';
import { differenceInDays, differenceInMonths, addMonths, format } from 'date-fns';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

// 5 months in days
const NAME_CHANGE_LOCK_MONTHS = 5;

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
  last_display_name_change: string | null;
  last_username_change: string | null;
}

const AccountSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
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
    last_display_name_change: null,
    last_username_change: null,
  });
  const [userEmail, setUserEmail] = useState('');
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }
    loadProfile();
    // Auto-detect location on first load if not set
    handleAutoDetectOnLoad();
  }, [user]);

  const handleAutoDetectOnLoad = async () => {
    // Always auto-detect location on page load (silently)
    handleDetectLocation(true);
  };

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, bio, avatar_url, country, city, phone_number, date_of_birth, gender, occupation, timezone, detected_country_code, last_display_name_change, last_username_change')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      const profileData = {
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
        last_display_name_change: data.last_display_name_change || null,
        last_username_change: data.last_username_change || null,
      };
      setProfile(profileData);
      setOriginalDisplayName(profileData.display_name);
      setOriginalUsername(profileData.username);
      
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

  const handleDetectLocation = async (silent = false) => {
    setDetectingLocation(true);
    try {
      const location: LocationData = await detectUserLocation();
      
      // Find matching country code
      const matchedCountry = COUNTRIES.find(c => 
        c.name.toLowerCase() === location.country.toLowerCase() ||
        c.code === location.countryCode
      );
      
      setProfile(prev => ({
        ...prev,
        country: matchedCountry?.name || location.country,
        city: location.city,
        timezone: location.timezone,
        detected_country_code: matchedCountry?.code || location.countryCode,
        // Auto-set phone prefix based on detected country
        phone_number: prev.phone_number || (matchedCountry ? getDialCodeForCountry(matchedCountry.code) + ' ' : ''),
      }));

      if (!silent) {
        toast({
          title: 'Location detected',
          description: `${location.city ? location.city + ', ' : ''}${location.country}`,
        });
      }
    } catch (error: any) {
      if (!silent) {
        toast({
          title: 'Could not detect location',
          description: 'Please select your country manually.',
          variant: 'destructive',
        });
      }
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleCountrySelect = (countryCode: string) => {
    const country = getCountryByCode(countryCode);
    if (country) {
      const dialCode = getDialCodeForCountry(countryCode);
      setProfile(prev => ({
        ...prev,
        country: country.name,
        detected_country_code: countryCode,
        city: '', // Reset city when country changes
        // Update phone number prefix
        phone_number: dialCode + ' ',
      }));
    }
    setCountryOpen(false);
  };

  const handleCitySelect = (city: string) => {
    setProfile(prev => ({ ...prev, city }));
    setCityOpen(false);
  };

  const canChangeDisplayName = (): boolean => {
    if (!profile.last_display_name_change) return true;
    const lastChange = new Date(profile.last_display_name_change);
    const monthsSince = differenceInMonths(new Date(), lastChange);
    return monthsSince >= NAME_CHANGE_LOCK_MONTHS;
  };

  const canChangeUsername = (): boolean => {
    if (!profile.last_username_change) return true;
    const lastChange = new Date(profile.last_username_change);
    const monthsSince = differenceInMonths(new Date(), lastChange);
    return monthsSince >= NAME_CHANGE_LOCK_MONTHS;
  };

  const getNameChangeCountdown = (lastChange: string | null): string => {
    if (!lastChange) return '';
    const lastChangeDate = new Date(lastChange);
    const unlockDate = addMonths(lastChangeDate, NAME_CHANGE_LOCK_MONTHS);
    const daysRemaining = differenceInDays(unlockDate, new Date());
    
    if (daysRemaining <= 0) return '';
    
    const monthsRemaining = Math.floor(daysRemaining / 30);
    const daysLeft = daysRemaining % 30;
    
    if (monthsRemaining > 0) {
      return `${monthsRemaining} month${monthsRemaining > 1 ? 's' : ''}${daysLeft > 0 ? ` ${daysLeft} day${daysLeft > 1 ? 's' : ''}` : ''}`;
    }
    return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
  };

  const validatePhoneCountry = (): boolean => {
    if (!profile.phone_number || !profile.detected_country_code) return true;
    
    const expectedDialCode = getDialCodeForCountry(profile.detected_country_code);
    if (!expectedDialCode) return true;
    
    // Check if phone number starts with the country's dial code
    const phoneClean = profile.phone_number.replace(/\s+/g, '');
    return phoneClean.startsWith(expectedDialCode);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validate phone number matches country
      if (!validatePhoneCountry()) {
        const country = getCountryByCode(profile.detected_country_code);
        const expectedDialCode = getDialCodeForCountry(profile.detected_country_code);
        toast({
          title: 'Phone number mismatch',
          description: `Your phone number must match ${country?.name || 'your selected country'} (${expectedDialCode})`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const currency = profile.detected_country_code 
        ? getCurrencyForCountry(profile.detected_country_code)
        : 'USD';

      const updateData: any = {
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
      };

      // Check if display name changed and is allowed
      if (profile.display_name !== originalDisplayName) {
        if (!canChangeDisplayName()) {
          const countdown = getNameChangeCountdown(profile.last_display_name_change);
          toast({
            title: 'Cannot change display name',
            description: `You can change your display name in ${countdown}`,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        updateData.display_name = profile.display_name;
        updateData.last_display_name_change = new Date().toISOString();
      }

      // Check if username changed and is allowed
      if (profile.username !== originalUsername) {
        if (!canChangeUsername()) {
          const countdown = getNameChangeCountdown(profile.last_username_change);
          toast({
            title: 'Cannot change username',
            description: `You can change your username in ${countdown}`,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        updateData.username = profile.username;
        updateData.last_username_change = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user?.id);

      if (error) throw error;

      // Update original values after successful save
      if (updateData.display_name) setOriginalDisplayName(profile.display_name);
      if (updateData.username) setOriginalUsername(profile.username);

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

  const filteredCountries = countrySearch
    ? COUNTRIES.filter(c => 
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : COUNTRIES;

  const availableCities = profile.detected_country_code 
    ? getCitiesForCountry(profile.detected_country_code)
    : [];

  const filteredCities = citySearch
    ? availableCities.filter(city => 
        city.toLowerCase().includes(citySearch.toLowerCase())
      )
    : availableCities;

  const displayNameLocked = !canChangeDisplayName();
  const usernameLocked = !canChangeUsername();

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
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                Email cannot be changed. 
                <Link to="/settings/help" className="text-primary hover:underline inline-flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Contact Help Center
                </Link>
              </p>
            </div>

            <div>
              <Label htmlFor="display_name" className="flex items-center gap-2">
                Display Name
                {displayNameLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input
                id="display_name"
                value={profile.display_name || ''}
                onChange={(e) =>
                  setProfile({ ...profile, display_name: e.target.value })
                }
                placeholder="Your display name"
                className={cn("bg-background", displayNameLocked && "bg-muted cursor-not-allowed")}
                disabled={displayNameLocked}
              />
              {displayNameLocked && (
                <p className="text-xs text-muted-foreground mt-1">
                  Can change in {getNameChangeCountdown(profile.last_display_name_change)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="username" className="flex items-center gap-2">
                Username
                {usernameLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input
                id="username"
                value={profile.username || ''}
                onChange={(e) =>
                  setProfile({ ...profile, username: e.target.value })
                }
                placeholder="@username"
                className={cn("bg-background", usernameLocked && "bg-muted cursor-not-allowed")}
                disabled={usernameLocked}
              />
              {usernameLocked && (
                <p className="text-xs text-muted-foreground mt-1">
                  Can change in {getNameChangeCountdown(profile.last_username_change)}
                </p>
              )}
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
              <Select
                value={profile.occupation || ''}
                onValueChange={(value) => setProfile({ ...profile, occupation: value })}
              >
                <SelectTrigger className="bg-background">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Select your occupation" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {OCCUPATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                onClick={() => handleDetectLocation(false)}
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

            {/* Country Selector with Search */}
            <div>
              <Label>Country</Label>
              <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    className="w-full justify-between bg-background"
                  >
                    {profile.detected_country_code ? (
                      <span className="flex items-center gap-2">
                        <span>{getCountryFlag(profile.detected_country_code)}</span>
                        <span>{profile.country}</span>
                      </span>
                    ) : (
                      "Select your country..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-50" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search country..." 
                      value={countrySearch}
                      onValueChange={setCountrySearch}
                    />
                    <CommandList>
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {filteredCountries.map((country) => (
                          <CommandItem
                            key={country.code}
                            value={country.name}
                            onSelect={() => handleCountrySelect(country.code)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                profile.detected_country_code === country.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="mr-2">{getCountryFlag(country.code)}</span>
                            <span>{country.name}</span>
                            <span className="ml-auto text-muted-foreground text-xs">{country.dialCode}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Required for P2P marketplace and currency settings
              </p>
            </div>

            {/* City Selector */}
            <div>
              <Label>City</Label>
              <Popover open={cityOpen} onOpenChange={setCityOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={cityOpen}
                    className="w-full justify-between bg-background"
                    disabled={!profile.detected_country_code}
                  >
                    {profile.city || "Select your city..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-50" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search city..." 
                      value={citySearch}
                      onValueChange={setCitySearch}
                    />
                    <CommandList>
                      <CommandEmpty>No city found. Type to search.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {filteredCities.map((city) => (
                          <CommandItem
                            key={city}
                            value={city}
                            onSelect={() => handleCitySelect(city)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                profile.city === city ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {city}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Phone Number with Country Code */}
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
                  placeholder={profile.detected_country_code ? `${getDialCodeForCountry(profile.detected_country_code)} xxx xxx xxxx` : '+x xxx xxx xxxx'}
                  className="bg-background flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Must match your selected country ({profile.detected_country_code ? getDialCodeForCountry(profile.detected_country_code) : 'select country first'})
              </p>
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
      </main>

      <BottomNav />
    </div>
  );
};

export default AccountSettings;
