import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Globe, Users, Target } from 'lucide-react';

const INTERESTS = [
  'Technology', 'Gaming', 'Music', 'Sports', 'Fashion',
  'Food', 'Travel', 'Fitness', 'Art', 'Photography',
  'Business', 'Education', 'Entertainment', 'Lifestyle',
  'Finance', 'Health', 'Beauty', 'Automotive', 'Pets'
];

const GENDERS = ['All', 'Male', 'Female', 'Other'];

interface AdTargetingFormProps {
  ageRange: [number, number];
  onAgeRangeChange: (range: [number, number]) => void;
  interests: string[];
  onInterestsChange: (interests: string[]) => void;
  genders: string[];
  onGendersChange: (genders: string[]) => void;
  isGlobal: boolean;
  onIsGlobalChange: (global: boolean) => void;
}

export const AdTargetingForm = ({
  ageRange,
  onAgeRangeChange,
  interests,
  onInterestsChange,
  genders,
  onGendersChange,
  isGlobal,
  onIsGlobalChange,
}: AdTargetingFormProps) => {
  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      onInterestsChange(interests.filter((i) => i !== interest));
    } else {
      onInterestsChange([...interests, interest]);
    }
  };

  const toggleGender = (gender: string) => {
    if (gender === 'All') {
      onGendersChange(['All']);
    } else {
      const newGenders = genders.filter(g => g !== 'All');
      if (newGenders.includes(gender)) {
        onGendersChange(newGenders.filter((g) => g !== gender));
      } else {
        onGendersChange([...newGenders, gender]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Age Range */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="w-4 h-4 text-primary" />
          Age Range
        </Label>
        <div className="px-2">
          <Slider
            value={ageRange}
            onValueChange={(value) => onAgeRangeChange(value as [number, number])}
            min={13}
            max={65}
            step={1}
            className="w-full"
          />
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{ageRange[0]} years</span>
          <span>{ageRange[1]}+ years</span>
        </div>
      </div>

      {/* Gender Targeting */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="w-4 h-4 text-primary" />
          Gender
        </Label>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((gender) => (
            <Badge
              key={gender}
              variant={genders.includes(gender) || (gender === 'All' && genders.length === 0) ? 'default' : 'outline'}
              className={`cursor-pointer transition-all ${
                genders.includes(gender) || (gender === 'All' && genders.length === 0)
                  ? 'bg-primary hover:bg-primary/90'
                  : 'hover:bg-secondary'
              }`}
              onClick={() => toggleGender(gender)}
            >
              {gender}
            </Badge>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="w-4 h-4 text-primary" />
          Location
        </Label>
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
          <div>
            <p className="text-sm font-medium">Global Reach</p>
            <p className="text-xs text-muted-foreground">
              Show your ad to users worldwide
            </p>
          </div>
          <Switch checked={isGlobal} onCheckedChange={onIsGlobalChange} />
        </div>
      </div>

      {/* Interests */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Target className="w-4 h-4 text-primary" />
          Interests
          <span className="text-xs text-muted-foreground font-normal">
            ({interests.length} selected)
          </span>
        </Label>
        <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
          {INTERESTS.map((interest) => (
            <Badge
              key={interest}
              variant={interests.includes(interest) ? 'default' : 'outline'}
              className={`cursor-pointer transition-all ${
                interests.includes(interest)
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border-0'
                  : 'hover:bg-secondary'
              }`}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {interests.length === 0
            ? 'No interests selected - your ad will reach all users'
            : `Targeting users interested in: ${interests.slice(0, 3).join(', ')}${interests.length > 3 ? ` +${interests.length - 3} more` : ''}`}
        </p>
      </div>
    </div>
  );
};
