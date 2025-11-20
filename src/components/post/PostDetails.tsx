import { useState } from 'react';
import { Sparkles, ImagePlus, Globe, Users, UserCheck, Lock } from 'lucide-react';

interface PostDetailsProps {
  onSubmit: (data: any) => void;
}

export default function PostDetails({ onSubmit }: PostDetailsProps) {
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'everyone' | 'friends' | 'followers' | 'only_me'>('everyone');
  const [detectFaces, setDetectFaces] = useState(false);

  const privacyOptions = [
    { value: 'everyone' as const, label: 'Everyone', icon: Globe },
    { value: 'friends' as const, label: 'Friends', icon: Users },
    { value: 'followers' as const, label: 'Followers', icon: UserCheck },
    { value: 'only_me' as const, label: 'Only Me', icon: Lock },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start p-4 overflow-y-auto max-w-sm mx-auto">
      <h2 className="text-lg font-bold mb-4">Post Details</h2>

      <textarea
        placeholder="Write a caption..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full p-3 border border-border rounded-lg text-sm resize-none mb-4"
        rows={4}
      />

      <div className="w-full mb-4">
        <label className="text-xs font-medium mb-1 block">Privacy</label>
        <div className="flex flex-wrap gap-2">
          {privacyOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPrivacy(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                privacy === opt.value ? 'bg-primary text-white' : 'bg-muted text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setDetectFaces(!detectFaces)}
        className={`w-full flex items-center justify-between p-3 rounded-lg border ${
          detectFaces ? 'border-primary bg-primary/10' : 'border-border'
        } mb-4`}
      >
        <span className="text-sm font-medium">Detect Faces</span>
        <Sparkles className="w-5 h-5 text-muted-foreground" />
      </button>

      <button
        onClick={() => console.log('Open gallery')}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary mb-6"
      >
        <span className="text-sm font-medium">Add from Gallery</span>
        <ImagePlus className="w-5 h-5 text-muted-foreground" />
      </button>

      <button
        onClick={() => onSubmit({ caption, privacy, detectFaces })}
        className="w-full py-3 rounded-full bg-primary text-white font-semibold text-sm"
      >
        Post
      </button>
    </div>
  );
}
