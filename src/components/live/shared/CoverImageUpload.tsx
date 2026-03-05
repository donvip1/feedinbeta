import { useState, useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CoverImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

export const CoverImageUpload = ({ value, onChange, className }: CoverImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to upload');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/live-covers/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-content')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-content')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success('Cover image uploaded!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        <ImagePlus className="w-3.5 h-3.5" />
        Event Cover (optional)
      </label>
      
      {value ? (
        <div className="relative w-full aspect-[3/4] max-h-48 rounded-2xl overflow-hidden bg-white/5">
          <img 
            src={value} 
            alt="Cover preview" 
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full aspect-[3/4] max-h-40 rounded-2xl border-2 border-dashed border-white/10",
            "flex flex-col items-center justify-center gap-2",
            "hover:border-rose-500/30 hover:bg-white/[0.03] transition-colors",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-slate-500" />
              <span className="text-xs text-slate-500 font-bold">Add portrait cover</span>
              <span className="text-[10px] text-slate-600">3:4 ratio recommended</span>
            </>
          )}
        </button>
      )}
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      
      <p className="text-[10px] text-slate-600">
        Portrait format • Appears on your stream card
      </p>
    </div>
  );
};
