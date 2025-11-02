import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImageEnhancement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [enhancedUrl, setEnhancedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"good" | "better" | "best">("good");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEnhancedUrl("");
    }
  };

  const handleEnhance = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    if (!selectedFile) {
      toast({ title: "Please select an image first", variant: "destructive" });
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

      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        const base64Image = reader.result as string;

        const enhancementPrompts = {
          good: "Enhance this image with basic improvements: adjust brightness, contrast, and sharpness",
          better: "Significantly enhance this image with advanced improvements: optimize colors, enhance details, reduce noise, improve overall quality",
          best: "Ultra enhance this image with maximum quality improvements: professional color grading, detail enhancement, noise reduction, sharpening, and overall quality optimization"
        };

        // Use AI to enhance image
        const { data, error } = await supabase.functions.invoke("ai-image-gen", {
          body: { 
            prompt: `${enhancementPrompts[selectedLevel]}. Original image: ${base64Image}`
          }
        });

        if (error) throw error;

        if (data?.imageUrl) {
          setEnhancedUrl(data.imageUrl);

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
                description: "Image enhancement"
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

          toast({ title: "Image enhanced successfully!" });
        }
      };
    } catch (error: any) {
      console.error("Error:", error);
      toast({ title: "Enhancement failed", description: error.message, variant: "destructive" });
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
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Image Enhancement</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-4">
            Upload an image and choose enhancement level to improve its quality.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!previewUrl ? (
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 border-2 border-dashed"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8" />
                <span>Click to upload image</span>
              </div>
            </Button>
          ) : (
            <div className="space-y-4">
              <img src={previewUrl} alt="Preview" className="w-full rounded-lg" />
              <Button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl("");
                  setEnhancedUrl("");
                }}
                variant="outline"
                className="w-full"
              >
                Change Image
              </Button>
            </div>
          )}
        </div>

        {previewUrl && (
          <div className="bg-card rounded-lg p-4 border space-y-4">
            <h3 className="font-semibold">Enhancement Level:</h3>
            <Tabs value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="good">Good</TabsTrigger>
                <TabsTrigger value="better">Better</TabsTrigger>
                <TabsTrigger value="best">Best (Ultra)</TabsTrigger>
              </TabsList>
              <TabsContent value="good" className="text-sm text-muted-foreground">
                Basic enhancements: brightness, contrast, sharpness
              </TabsContent>
              <TabsContent value="better" className="text-sm text-muted-foreground">
                Advanced: color optimization, detail enhancement, noise reduction
              </TabsContent>
              <TabsContent value="best" className="text-sm text-muted-foreground">
                Ultra: professional-grade enhancement with maximum quality
              </TabsContent>
            </Tabs>

            <Button onClick={handleEnhance} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enhancing...
                </>
              ) : (
                "Enhance Image"
              )}
            </Button>
          </div>
        )}

        {enhancedUrl && (
          <div className="bg-card rounded-lg p-4 border">
            <h3 className="font-semibold mb-3">Enhanced Image:</h3>
            <img src={enhancedUrl} alt="Enhanced" className="w-full rounded-lg" />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
