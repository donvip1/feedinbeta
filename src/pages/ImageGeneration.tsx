import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function ImageGeneration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    if (!prompt.trim()) {
      toast({ title: "Please enter an image description", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check credits and limits
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_ai_image_count, last_ai_reset")
        .eq("id", user.id)
        .single();

      const { data: credits } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAdmin = roles?.some(r => r.role === "admin" || r.role === "moderator");

      if (!isAdmin) {
        const today = new Date().toDateString();
        const lastReset = profile?.last_ai_reset ? new Date(profile.last_ai_reset).toDateString() : null;
        const currentCount = lastReset === today ? profile?.daily_ai_image_count || 0 : 0;

        if (currentCount >= 1) {
          if (!credits || credits.balance < 20) {
            toast({
              title: "Daily limit reached",
              description: "You need 20 credits to continue or wait until tomorrow",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
        }
      }

      // Generate image
      const { data, error } = await supabase.functions.invoke("ai-image-gen", {
        body: { prompt }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);

        // Deduct credits if needed
        if (!isAdmin) {
          const today = new Date().toDateString();
          const lastReset = profile?.last_ai_reset ? new Date(profile.last_ai_reset).toDateString() : null;
          const currentCount = lastReset === today ? profile?.daily_ai_image_count || 0 : 0;

          if (currentCount >= 1 && credits && credits.balance >= 20) {
          await supabase.from("credit_transactions").insert({
            user_id: user.id,
            amount: -20,
            type: "ai_generation",
            description: "Image generation"
          });
          }

          await supabase
            .from("profiles")
            .update({
              daily_ai_image_count: currentCount + 1,
              last_ai_reset: new Date().toISOString()
            })
            .eq("id", user.id);
        }

        toast({ title: "Image generated successfully!" });
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Image Generation</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-4">
            Describe the image you want to create and AI will generate it for you.
          </p>
          <Textarea
            placeholder="E.g., 'A futuristic cityscape at sunset with flying cars'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] mb-4"
          />
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Image...
              </>
            ) : (
              "Generate Image"
            )}
          </Button>
        </div>

        {imageUrl && (
          <div className="bg-card rounded-lg p-4 border">
            <h3 className="font-semibold mb-3">Generated Image:</h3>
            <img src={imageUrl} alt="Generated" className="w-full rounded-lg" />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
