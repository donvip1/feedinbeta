import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  Image as ImageIcon, 
  MessageCircle, 
  Share2,
  User,
  Sparkles,
  Loader2
} from "lucide-react";
import { compressImage } from "@/lib/image-optimizer";

interface ImageShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  imageType?: "enhanced" | "generated";
}

export function ImageShareModal({ open, onOpenChange, imageUrl, imageType = "enhanced" }: ImageShareModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const downloadImage = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedin-${imageType}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Image downloaded successfully!" });
    } catch (error) {
      toast({ title: "Failed to download image", variant: "destructive" });
    }
  };

  const uploadToStorage = async (blob: Blob): Promise<string | null> => {
    try {
      const fileName = `${user?.id}/${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, blob);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const shareAsPost = async () => {
    setLoading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "image.png", { type: "image/png" });
      const compressed = await compressImage(file);
      
      const uploadedUrl = await uploadToStorage(compressed);
      if (!uploadedUrl) {
        throw new Error("Failed to upload image");
      }

      // Navigate to feed with the image URL in state
      navigate('/feed', { state: { sharedImage: uploadedUrl } });
      onOpenChange(false);
      toast({ title: "Redirecting to create post..." });
    } catch (error) {
      toast({ title: "Failed to share as post", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setAsProfilePicture = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "profile.png", { type: "image/png" });
      
      const fileName = `${user.id}/profile-${Date.now()}.png`;
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
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({ title: "Profile picture updated!" });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Failed to set profile picture", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addToStory = async () => {
    setLoading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "story.png", { type: "image/png" });
      const compressed = await compressImage(file);
      
      const uploadedUrl = await uploadToStorage(compressed);
      if (!uploadedUrl) {
        throw new Error("Failed to upload image");
      }

      // Create story
      const { error } = await supabase
        .from('stories')
        .insert({
          user_id: user?.id,
          media_url: uploadedUrl,
          media_type: 'image'
        });

      if (error) throw error;

      toast({ title: "Story created successfully!" });
      onOpenChange(false);
      navigate('/feed');
    } catch (error) {
      toast({ title: "Failed to add to story", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const shareViaDM = () => {
    toast({ title: "Coming soon", description: "Share via DM will be available soon" });
  };

  const shareExternal = async (platform: 'whatsapp' | 'facebook' | 'twitter') => {
    const text = `Check out this ${imageType} image from FeedIn!`;
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + imageUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(imageUrl)}`
    };
    
    window.open(urls[platform], '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Image
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Button
            onClick={downloadImage}
            variant="outline"
            className="w-full justify-start"
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Download to Device
          </Button>

          <Button
            onClick={shareAsPost}
            variant="outline"
            className="w-full justify-start"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            Share as Post
          </Button>

          <Button
            onClick={setAsProfilePicture}
            variant="outline"
            className="w-full justify-start"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <User className="h-4 w-4 mr-2" />}
            Set as Profile Picture
          </Button>

          <Button
            onClick={addToStory}
            variant="outline"
            className="w-full justify-start"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Add to Story
          </Button>

          <Button
            onClick={shareViaDM}
            variant="outline"
            className="w-full justify-start"
            disabled={loading}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Share via DM
          </Button>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Share to External Apps</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => shareExternal('whatsapp')}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                WhatsApp
              </Button>
              <Button
                onClick={() => shareExternal('facebook')}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Facebook
              </Button>
              <Button
                onClick={() => shareExternal('twitter')}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Twitter
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
