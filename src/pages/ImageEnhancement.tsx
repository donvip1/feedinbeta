import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Upload, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageShareModal } from "@/components/shared/ImageShareModal";

// --- Static Data ---
const ENHANCEMENT_PROMPTS = {
  good: "Enhance this image with basic improvements: adjust brightness, contrast, and sharpness",
  better: "Significantly enhance this image with advanced improvements: optimize colors, enhance details, reduce noise, improve overall quality",
  best: "Ultra enhance this image with maximum quality improvements: professional color grading, detail enhancement, noise reduction, sharpening, and overall quality optimization"
};

const PROGRESS_MESSAGES = [
  "Analyzing your image...",
  "Touching up details...",
  "Fixing the lighting...",
  "Enhancing colors...",
  "Smoothing textures...",
  "Removing blur...",
  "Sharpening edges...",
  "Optimizing quality...",
  "Finalizing enhancements..."
];

const ENHANCEMENT_CREDIT_COST = 10;
const TIMEOUT_MS = 60000; // 60 seconds

// --- Utility Function ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// --- Component Definition ---

// Simple type for the Supabase function response data
type AiImageGenResponse = {
  data: { imageUrl?: string } | null;
  error: { message: string } | null;
}

export default function ImageEnhancement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [enhancedUrl1, setEnhancedUrl1] = useState("");
  const [enhancedUrl2, setEnhancedUrl2] = useState("");
  const [selectedResult, setSelectedResult] = useState<1 | 2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"good" | "better" | "best">("good");
  const [editPrompt, setEditPrompt] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  // Cleanup for preview URL object when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke old URL before creating a new one (cleanup improvement)
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEnhancedUrl1("");
      setEnhancedUrl2("");
      setSelectedResult(null);
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
    setLoadingStage(0);
    let progressInterval: number | undefined; // Declared outside try block

    try {
      // 1. Setup Progress Interval
      progressInterval = setInterval(() => {
        setLoadingStage(prev => (prev + 1) % PROGRESS_MESSAGES.length);
      }, 3000) as unknown as number;

      // 2. Check Credits and Limits
      const { data: profile } = await supabase
        .from("profiles")
        .select("last_free_enhancement, daily_enhancement_count, last_enhancement_reset")
        .eq("id", user.id)
        .single();
      
      const { data: credits } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      const lastFreeEnhancement = profile?.last_free_enhancement ? new Date(profile.last_free_enhancement) : null;
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const canUseFree = !lastFreeEnhancement || lastFreeEnhancement < threeDaysAgo;
      
      const today = new Date().toDateString();
      const lastReset = profile?.last_enhancement_reset ? new Date(profile.last_enhancement_reset).toDateString() : null;
      const dailyCount = lastReset === today ? profile?.daily_enhancement_count || 0 : 0;

      let willDeductCredits = false;

      if (!canUseFree) {
        if (!credits || credits.balance < ENHANCEMENT_CREDIT_COST) {
          const daysUntilFree = Math.ceil((new Date(lastFreeEnhancement!).getTime() + 3 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
          throw new Error(`Credits required: You need ${ENHANCEMENT_CREDIT_COST} credits. Free enhancement available in ${daysUntilFree} days.`);
        }
        
        if (dailyCount >= 3) {
          throw new Error("Daily limit reached: You can enhance 3 times per day with credits.");
        }
        
        willDeductCredits = true;
      }

      // 3. Prepare Image and Prompt
      const base64Image = await fileToBase64(selectedFile);

      let finalPrompt = ENHANCEMENT_PROMPTS[selectedLevel];
      if (editPrompt.trim()) {
        finalPrompt += `. Additionally: ${editPrompt}`;
      }

      // 4. Generate Enhancements with Timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Enhancement is taking longer than expected. Please try again.")), TIMEOUT_MS)
      );

      const enhancementPromise = Promise.all<AiImageGenResponse>([
        supabase.functions.invoke("ai-image-gen", {
          body: { prompt: finalPrompt + " (variation 1)", imageUrl: base64Image, mode: "edit" }
        }),
        supabase.functions.invoke("ai-image-gen", {
          body: { prompt: finalPrompt + " (variation 2)", imageUrl: base64Image, mode: "edit" }
        })
      ]);

      const [result1, result2] = await Promise.race([enhancementPromise, timeoutPromise]) as AiImageGenResponse[];

      // 5. Handle AI Response Errors
      if (result1.error || result2.error) {
        const errorMsg = result1.error?.message || result2.error?.message || "Enhancement failed";
        
        if (errorMsg.includes("Rate limit")) {
          throw new Error("Too many requests. Please wait a moment and try again.");
        } else if (errorMsg.includes("credits exhausted")) {
          // Assuming this error comes from an external AI service
          throw new Error("AI service temporarily unavailable. Please try again later.");
        } else {
          throw new Error(errorMsg);
        }
      }

      const url1 = result1.data?.imageUrl;
      const url2 = result2.data?.imageUrl;

      if (!url1 || !url2) {
        throw new Error("Failed to generate enhanced images. Missing image URLs.");
      }

      setEnhancedUrl1(url1);
      setEnhancedUrl2(url2);

      // 6. Update User Profile/Credits
      if (willDeductCredits) {
        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: -ENHANCEMENT_CREDIT_COST,
          type: "ai_generation",
          description: "Image enhancement"
        });

        await supabase
          .from("profiles")
          .update({
            daily_enhancement_count: dailyCount + 1,
            last_enhancement_reset: new Date().toISOString()
          })
          .eq("id", user.id);
      } else {
        await supabase
          .from("profiles")
          .update({
            last_free_enhancement: new Date().toISOString()
          })
          .eq("id", user.id);
      }

      toast({ title: "Images enhanced successfully! Pick your favorite." });

    } catch (error: any) {
      console.error("Enhancement error:", error);
      
      let errorTitle = "Enhancement failed";
      let errorDescription = error.message || "Please try again";
      
      // Check for custom error message set earlier (e.g., from credit check)
      if (error.message && !error.message.includes("Error")) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive"
      });
    } finally {
      // Ensure the interval is cleared in all cases
      if (progressInterval !== undefined) {
        clearInterval(progressInterval);
      }
      setLoading(false);
      setLoadingStage(0);
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
              {/* Added a better alt text */}
              <img src={previewUrl} alt="Original uploaded image" className="w-full rounded-lg" />
              <Button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl("");
                  setEnhancedUrl1("");
                  setEnhancedUrl2("");
                  setSelectedResult(null);
                  setEditPrompt(""); // Reset prompt on change
                  // Optional: if fileInputRef is needed to reset, you can add: fileInputRef.current!.value = ""
                }}
                variant="outline"
                className="w-full"
              >
                Change Image
              </Button>
            </div>
          )}
        </div>

        {previewUrl && !enhancedUrl1 && !loading && (
          <div className="bg-card rounded-lg p-4 border space-y-4">
            <h3 className="font-semibold">Enhancement Level:</h3>
            <Tabs value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as "good" | "better" | "best")}>
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

            <div className="space-y-2">
              <Label htmlFor="editPrompt">Optional AI Edits (e.g., add cap, change background, etc.)</Label>
              <Input
                id="editPrompt"
                placeholder="e.g., add a baseball cap, change background to beach, make wearing sunglasses"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for enhancement only, or add specific edits you want to apply
              </p>
            </div>

            <Button onClick={handleEnhance} disabled={loading} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              Enhance Image
            </Button>
          </div>
        )}

        {loading && (
          <div className="bg-card rounded-lg p-12 border flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">
              {/* Use the static array defined outside the component */}
              {PROGRESS_MESSAGES[loadingStage]}
            </p>
            <p className="text-sm text-muted-foreground">Generating two variations for you to choose from</p>
            <div className="flex gap-1 mt-2">
              {/* Use the static array length */}
              {Array.from({ length: PROGRESS_MESSAGES.length }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-all ${
                    i === loadingStage ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {enhancedUrl1 && enhancedUrl2 && (
          <div className="space-y-4">
            <div className="bg-card rounded-lg p-4 border">
              <h3 className="font-semibold mb-3">Pick Your Favorite Result:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`cursor-pointer rounded-lg border-2 transition-all ${
                    selectedResult === 1 ? 'border-primary ring-2 ring-primary' : 'border-border'
                  }`}
                  onClick={() => setSelectedResult(1)}
                >
                  <p className="text-sm font-medium p-2 text-center">Result 1 {selectedResult === 1 && '✓'}</p>
                  <img src={enhancedUrl1} alt="Enhanced Result 1" className="w-full rounded-b-lg" />
                </div>
                <div
                  className={`cursor-pointer rounded-lg border-2 transition-all ${
                    selectedResult === 2 ? 'border-primary ring-2 ring-primary' : 'border-border'
                  }`}
                  onClick={() => setSelectedResult(2)}
                >
                  <p className="text-sm font-medium p-2 text-center">Result 2 {selectedResult === 2 && '✓'}</p>
                  <img src={enhancedUrl2} alt="Enhanced Result 2" className="w-full rounded-b-lg" />
                </div>
              </div>
              
              {selectedResult && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold mb-2">Before & After:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <img src={previewUrl} alt="Before enhancement" className="w-full rounded-lg border" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <img
                        src={selectedResult === 1 ? enhancedUrl1 : enhancedUrl2}
                        alt="Selected enhanced image"
                        className="w-full rounded-lg border"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowShareModal(true)}
                className="flex-1"
                variant="default"
                disabled={!selectedResult}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Selected
              </Button>
              <Button
                onClick={() => {
                  setEnhancedUrl1("");
                  setEnhancedUrl2("");
                  setSelectedResult(null);
                  setEditPrompt("");
                }}
                variant="outline"
                className="flex-1"
              >
                Enhance Again
              </Button>
            </div>
          </div>
        )}
      </div>

      <ImageShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        imageUrl={selectedResult === 1 ? enhancedUrl1 : enhancedUrl2}
        imageType="enhanced"
      />

      <BottomNav />
    </div>
  );
}