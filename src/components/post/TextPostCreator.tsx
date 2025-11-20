import { useState } from 'react';
import {
  X,
  Music2,
  Palette,
  Type,
  Globe,
  Users,
  UserCheck,
  Lock,
  Hash,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Stage = 'style' | 'compose' | 'details';
type BackgroundStyle = 'plain' | 'gradient' | 'image';
type Privacy = 'everyone' | 'friends' | 'followers' | 'only_me';

const solidColorOptions = [
  'bg-slate-800',
  'bg-gray-900',
  'bg-zinc-800',
  'bg-stone-800',
  'bg-red-900',
  'bg-orange-900',
  'bg-amber-900',
  'bg-yellow-900',
];

const gradientOptions = [
  'bg-gradient-to-br from-purple-600 to-pink-600',
  'bg-gradient-to-br from-blue-600 to-cyan-600',
  'bg-gradient-to-br from-green-600 to-emerald-600',
  'bg-gradient-to-br from-orange-600 to-red-600',
  'bg-gradient-to-br from-indigo-600 to-purple-600',
  'bg-gradient-to-br from-pink-600 to-rose-600',
  'bg-gradient-to-br from-yellow-600 to-orange-600',
  'bg-gradient-to-br from-teal-600 to-blue-600',
];

interface TextPostCreatorProps {
  onClose: () => void;
  onSubmit: () => void;
}

export default function TextPostCreator({ onClose, onSubmit }: TextPostCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('style');
  const [background, setBackground] = useState<BackgroundStyle>('gradient');
  const [selectedGradient, setSelectedGradient] = useState(gradientOptions[0]);
  const [selectedSolidColor, setSelectedSolidColor] = useState(solidColorOptions[0]);
  const [music, setMusic] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('everyone');

  const parsedHashtags = hashtags
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length > 0);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const containerCls = 'fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start p-4 overflow-y-auto max-w-sm mx-auto';

  const handlePost = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to post',
        variant: 'destructive',
      });
      return;
    }

    if (!text.trim()) {
      toast({
        title: 'Empty post',
        description: 'Please write something first',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Store background style in media_url for text posts with backgrounds
      const backgroundStyle = background !== 'image' ? getBackgroundClass() : null;
      
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: text,
        post_type: 'public',
        privacy: privacy,
        location: location || null,
        status: 'active',
        media_url: backgroundStyle, // Store background class here
        media_type: backgroundStyle ? 'text_styled' : null, // Mark as styled text post
      });

      if (error) throw error;

      toast({
        title: 'Posted!',
        description: 'Your text post has been shared',
      });

      onSubmit();
    } catch (error) {
      console.error('Error posting:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post',
        variant: 'destructive',
      });
    }
  };

  const getBackgroundClass = () => {
    if (background === 'plain') return selectedSolidColor;
    if (background === 'gradient') return selectedGradient;
    return 'bg-card';
  };

  const getTextColorClass = () => {
    return 'text-white';
  };

  return (
    <div className={containerCls}>
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Text Post</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* STAGE 1: Style Selector */}
      {stage === 'style' && (
        <div className="w-full space-y-4">
          <div className="text-sm font-medium text-muted-foreground">Choose background style</div>
          <div className="flex gap-2">
            <button
              onClick={() => setBackground('plain')}
              className={`flex-1 rounded-lg p-3 text-sm font-semibold transition ${
                background === 'plain' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              <Type className="w-5 h-5 mx-auto mb-1" />
              Solid
            </button>
            <button
              onClick={() => setBackground('gradient')}
              className={`flex-1 rounded-lg p-3 text-sm font-semibold transition ${
                background === 'gradient' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              <Palette className="w-5 h-5 mx-auto mb-1" />
              Gradient
            </button>
          </div>

          {/* Solid color selector */}
          {background === 'plain' && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {solidColorOptions.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSolidColor(color)}
                  className={`w-full h-16 rounded-lg ${color} ${
                    selectedSolidColor === color ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                />
              ))}
            </div>
          )}

          {/* Gradient selector */}
          {background === 'gradient' && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              {gradientOptions.map((grad, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedGradient(grad)}
                  className={`w-full h-16 rounded-lg ${grad} ${
                    selectedGradient === grad ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                />
              ))}
            </div>
          )}

          <div className="text-sm font-medium text-muted-foreground mt-6">Add music (optional)</div>
          <button
            onClick={() => setMusic(music ? null : 'Music Track')}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
              music ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'
            }`}
          >
            <span className="text-sm font-medium">{music || 'Select Music'}</span>
            <Music2 className={`w-5 h-5 ${music ? 'text-primary' : 'text-muted-foreground'}`} />
          </button>

          <button
            onClick={() => setStage('compose')}
            className="mt-6 w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* STAGE 2: Composer */}
      {stage === 'compose' && (
        <div className="w-full flex flex-col items-center">
          <div
            className={`w-full min-h-[60vh] rounded-lg flex items-center justify-center text-center p-6 mb-4 ${getBackgroundClass()}`}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={500}
              className={`w-full bg-transparent text-xl font-semibold resize-none outline-none text-center placeholder:opacity-70 ${getTextColorClass()}`}
              rows={8}
            />
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            {text.length}/500 characters
          </div>

          {music && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Music2 className="w-4 h-4" />
              <span>{music}</span>
            </div>
          )}

          <div className="w-full flex justify-between">
            <button
              onClick={() => setStage('style')}
              className="px-6 py-2 rounded-full bg-muted text-foreground font-semibold"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!text.trim()) {
                  toast({
                    title: 'Empty post',
                    description: 'Please write something first',
                    variant: 'destructive',
                  });
                  return;
                }
                setStage('details');
              }}
              className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: Post Details */}
      {stage === 'details' && (
        <div className="w-full space-y-4">
          {/* Preview */}
          <div
            className={`w-full min-h-[30vh] rounded-lg flex items-center justify-center text-center p-6 mb-4 ${getBackgroundClass()}`}
          >
            <p className={`text-lg font-semibold break-words ${getTextColorClass()}`}>
              {text}
            </p>
          </div>

          {/* Caption */}
          <label className="text-xs font-medium text-muted-foreground">Caption (optional)</label>
          <textarea
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full p-3 border border-input bg-background rounded-lg text-sm resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />

          {/* Hashtags */}
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Hash className="w-4 h-4" />
            Hashtags
          </label>
          <input
            type="text"
            placeholder="e.g. #thoughts #inspiration"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="w-full p-3 border border-input bg-background rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {parsedHashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {parsedHashtags.map((h) => (
                <span key={h} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  #{h}
                </span>
              ))}
            </div>
          )}

          {/* Location */}
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <MapPin className="w-4 h-4" />
            Location
          </label>
          <input
            type="text"
            placeholder="Add a location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-3 border border-input bg-background rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />

          {/* Privacy */}
          <label className="text-xs font-medium text-muted-foreground">Privacy</label>
          <div className="flex flex-wrap gap-2">
            {privacyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPrivacy(opt.value as Privacy)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  privacy === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setStage('compose')}
              className="flex-1 py-3 rounded-full bg-muted text-foreground font-semibold text-sm"
            >
              Back
            </button>
            <button
              onClick={handlePost}
              className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
            >
              Post
            </button>
          </div>

          <div className="h-6" />
        </div>
      )}
    </div>
  );
}
