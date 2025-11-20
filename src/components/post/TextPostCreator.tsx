import { useState } from 'react';
import { X, Globe, Users, UserCheck, Lock, Hash, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

type Privacy = 'everyone' | 'friends' | 'followers' | 'only_me';

const backgroundColors = [
  { id: 'gradient-1', style: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { id: 'gradient-2', style: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
  { id: 'gradient-3', style: 'bg-gradient-to-br from-green-500 to-emerald-500' },
  { id: 'gradient-4', style: 'bg-gradient-to-br from-orange-500 to-red-500' },
  { id: 'gradient-5', style: 'bg-gradient-to-br from-indigo-500 to-purple-500' },
  { id: 'gradient-6', style: 'bg-gradient-to-br from-pink-500 to-rose-500' },
  { id: 'gradient-7', style: 'bg-gradient-to-br from-yellow-500 to-orange-500' },
  { id: 'gradient-8', style: 'bg-gradient-to-br from-teal-500 to-blue-500' },
  { id: 'solid-1', style: 'bg-slate-900' },
  { id: 'solid-2', style: 'bg-red-600' },
  { id: 'solid-3', style: 'bg-blue-600' },
  { id: 'solid-4', style: 'bg-green-600' },
  { id: 'solid-5', style: 'bg-purple-600' },
  { id: 'solid-6', style: 'bg-pink-600' },
  { id: 'solid-7', style: 'bg-indigo-600' },
  { id: 'solid-8', style: 'bg-amber-600' },
];

interface TextPostCreatorProps {
  onClose: () => void;
  onSubmit: () => void;
}

export default function TextPostCreator({ onClose, onSubmit }: TextPostCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<'compose' | 'details'>('compose');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(backgroundColors[0]);
  
  // Post details
  const [caption, setCaption] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('everyone');

  const parsedHashtags = hashtagsInput
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag.length > 0);

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'followers', label: 'Followers', icon: UserCheck },
    { value: 'only_me', label: 'Only Me', icon: Lock },
  ];

  const handleNext = () => {
    if (!textContent.trim()) {
      toast({
        title: 'Empty post',
        description: 'Please write something first',
        variant: 'destructive',
      });
      return;
    }
    setStage('details');
  };

  const handlePost = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to post',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        feed_id: crypto.randomUUID(),
        content: textContent,
        post_type: 'text',
        privacy: privacy,
        location: location || null,
        status: 'active',
      });

      if (error) throw error;

      // Handle hashtags if needed
      if (parsedHashtags.length > 0) {
        // Process hashtags here if you have a hashtags system
      }

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

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start overflow-y-auto max-w-sm mx-auto">
      {/* Header */}
      <div className="w-full flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {stage === 'compose' ? 'Create text post' : 'Post details'}
        </h2>
        {stage === 'compose' && (
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Next
          </button>
        )}
        {stage === 'details' && (
          <button
            onClick={handlePost}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Post
          </button>
        )}
      </div>

      {/* COMPOSE STAGE */}
      {stage === 'compose' && (
        <div className="w-full flex flex-col items-center p-4 flex-1">
          {/* Text area with background */}
          <div className={`w-full rounded-2xl p-6 mb-4 min-h-[60vh] flex items-center justify-center ${selectedBg.style}`}>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-transparent border-none text-white text-xl font-medium text-center placeholder:text-white/70 focus-visible:ring-0 resize-none min-h-[50vh]"
              maxLength={500}
            />
          </div>
          
          <div className="text-xs text-muted-foreground mb-4">
            {textContent.length}/500 characters
          </div>

          {/* Background color selector */}
          <div className="w-full">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Background
            </label>
            <div className="grid grid-cols-8 gap-2 overflow-y-auto max-h-24">
              {backgroundColors.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBg(bg)}
                  className={`w-10 h-10 rounded-lg ${bg.style} ${
                    selectedBg.id === bg.id ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DETAILS STAGE */}
      {stage === 'details' && (
        <div className="w-full flex flex-col items-center p-4">
          {/* Preview */}
          <div className={`w-full rounded-2xl p-6 mb-4 min-h-[30vh] flex items-center justify-center ${selectedBg.style}`}>
            <p className="text-white text-lg font-medium text-center break-words">
              {textContent}
            </p>
          </div>

          {/* Caption */}
          <label className="mb-1 text-xs font-medium text-muted-foreground w-full">
            Caption (optional)
          </label>
          <Textarea
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="mb-3 w-full resize-none"
          />

          {/* Hashtags */}
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground w-full">
            <Hash className="h-4 w-4" /> Hashtags
          </label>
          <input
            type="text"
            placeholder="e.g. #thoughts #inspiration"
            value={hashtagsInput}
            onChange={(e) => setHashtagsInput(e.target.value)}
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          {parsedHashtags.length > 0 && (
            <div className="mb-3 w-full flex flex-wrap gap-2">
              {parsedHashtags.map((h) => (
                <span key={h} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  #{h}
                </span>
              ))}
            </div>
          )}

          {/* Location */}
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground w-full">
            <MapPin className="h-4 w-4" /> Location
          </label>
          <input
            type="text"
            placeholder="Add a location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />

          {/* Privacy */}
          <label className="mb-1 text-xs font-medium text-muted-foreground w-full">
            Visibility
          </label>
          <div className="mb-4 w-full flex flex-wrap gap-2">
            {privacyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPrivacy(opt.value as Privacy)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  privacy === (opt.value as Privacy)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-6" />
        </div>
      )}
    </div>
  );
}
