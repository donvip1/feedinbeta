import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video, Sparkles, Crown, Unlock } from "lucide-react";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";

// ADMIN CONFIG: Set to true to restrict live streaming to premium users only
// When false, all users can create live streams (current default for launch)
const REQUIRE_PREMIUM_FOR_STREAMING = false;

interface CreateLiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

export const CreateLiveStreamModal = ({ isOpen, onClose, onStreamCreated }: CreateLiveStreamModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isPremium: userIsPremium, loading: premiumLoading } = usePremiumStatus();

  // Check if user can create streams
  const canCreateStream = !REQUIRE_PREMIUM_FOR_STREAMING || userIsPremium;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Check premium requirement if enabled
    if (REQUIRE_PREMIUM_FOR_STREAMING && !userIsPremium) {
      toast.error("Premium subscription required to create live streams");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Generate stream key
      const { data: streamKeyData } = await supabase.rpc('generate_stream_key');
      
      const { data, error } = await supabase
        .from("live_streams")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          is_premium: isPremium,
          stream_key: streamKeyData || `stream_${Date.now()}`,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Live stream created!");
      onStreamCreated(data.id);
      onClose();
      
      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setIsPremium(false);
    } catch (error: any) {
      console.error("Error creating stream:", error);
      toast.error(error.message || "Failed to create stream");
    } finally {
      setLoading(false);
    }
  };

  // Show premium required message if streaming is restricted
  if (REQUIRE_PREMIUM_FOR_STREAMING && !userIsPremium && !premiumLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Premium Feature
            </DialogTitle>
            <DialogDescription>
              Live streaming is currently available for premium subscribers only.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg text-center">
              <Crown className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
              <h3 className="font-semibold mb-2">Upgrade to Premium</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get access to live streaming, exclusive content, and more!
              </p>
              <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
                View Plans
              </Button>
            </div>
          </div>
          
          <Button variant="outline" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Create Live Stream
          </DialogTitle>
          {!REQUIRE_PREMIUM_FOR_STREAMING && (
            <DialogDescription className="flex items-center gap-1 text-green-500">
              <Unlock className="w-3 h-3" />
              Live streaming is currently open for everyone!
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="What's your stream about?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell viewers what to expect..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Gaming, Music, Talk Show"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label htmlFor="premium" className="cursor-pointer">Premium Stream</Label>
            </div>
            <Switch
              id="premium"
              checked={isPremium}
              onCheckedChange={setIsPremium}
            />
          </div>
          {isPremium && (
            <p className="text-xs text-muted-foreground">
              Only subscribers can view this stream
            </p>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading || premiumLoading} className="flex-1">
              {loading ? "Creating..." : "Go Live"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};