import { useState, useRef } from "react";
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

export default function ImageEnhancement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [enhancedUrl1, setEnhancedUrl1] = useState("");
  const [enhancedUrl2, setEnhancedUrl2] = useState("");
  const [selectedResult, setSelectedResult] = useState<1 | 2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<"good" | "better" | "best">("good");
  const [editPrompt, setEditPrompt] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    try {
      // Check credits and limits
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

      // Check free enhancement eligibility (once per 3 days)
      const lastFreeEnhancement = profile?.last_free_enhancement ? new Date(profile.last_free_enhancement) : null;
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const canUseFree = !lastFreeEnhancement || lastFreeEnhancement < threeDaysAgo;

      // Check daily limit for free users with credits
      const today = new Date().toDateString();
      const lastReset = profile?.last_enhancement_reset ? new Date(profile.last_enhancement_reset).toDateString() : null;
      const dailyCount = lastReset === today ? profile?.daily_enhancement_count || 0 : 0;

      let willDeductCredits = false;
      let creditCost = 10;

      if (!canUseFree) {
        // Not eligible for free enhancement, need credits
        if (!credits || credits.balance < creditCost) {
          const daysUntilFree = Math.ceil((new Date(lastFreeEnhancement!).getTime() + 3 * 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
          toast({
            title: "Credits required",
            description: `You need ${creditCost} credits. Free enhancement available in ${daysUntilFree} days.`,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        if (dailyCount >= 3) {
          toast({
            title: "Daily limit reached",
            description: "You can enhance 3 times per day with credits",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        willDeductCredits = true;
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

        let finalPrompt = enhancementPrompts[selectedLevel];
        if (editPrompt.trim()) {
          finalPrompt += `. Additionally: ${editPrompt}`;
        }

        // Generate TWO different enhancement results
        const [result1, result2] = await Promise.all([
          supabase.functions.invoke("ai-image-gen", {
            body: { 
              prompt: finalPrompt + " (variation 1)",
              imageUrl: base64Image,
              mode: "edit"
            }
          }),
          supabase.functions.invoke("ai-image-gen", {
            body: { 
              prompt: finalPrompt + " (variation 2)",
              imageUrl: base64Image,
              mode: "edit"
            }
          })
        ]);

        if (result1.error || result2.error) {
          throw new Error(result1.error?.message || result2.error?.message || "Enhancement failed");
        }

        if (result1.data?.imageUrl && result2.data?.imageUrl) {
          setEnhancedUrl1(result1.data.imageUrl);
          setEnhancedUrl2(result2.data.imageUrl);

          // Deduct credits or update free enhancement timestamp
          if (willDeductCredits) {
            await supabase.from("credit_transactions").insert({
              user_id: user.id,
              amount: -creditCost,
              type: "ai_generation",
              description: "Image enhancement"
            });

            // Update daily count
            if (willDeductCredits) {
              await supabase
                .from("profiles")
                .update({
                  daily_enhancement_count: dailyCount + 1,
                  last_enhancement_reset: new Date().toISOString()
                })
                .eq("id", user.id);
            }
          } else {
            // Used free enhancement
            await supabase
              .from("profiles")
              .update({
                last_free_enhancement: new Date().toISOString()
              })
              .eq("id", user.id);
          }

          toast({ title: "Images enhanced successfully! Pick your favorite." });
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
                  setEnhancedUrl1("");
                  setEnhancedUrl2("");
                  setSelectedResult(null);
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
            <p className="text-lg font-medium">Enhancing your image...</p>
            <p className="text-sm text-muted-foreground">Generating two variations for you to choose from</p>
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
                  <img src={enhancedUrl1} alt="Result 1" className="w-full rounded-b-lg" />
                </div>
                <div 
                  className={`cursor-pointer rounded-lg border-2 transition-all ${
                    selectedResult === 2 ? 'border-primary ring-2 ring-primary' : 'border-border'
                  }`}
                  onClick={() => setSelectedResult(2)}
                >
                  <p className="text-sm font-medium p-2 text-center">Result 2 {selectedResult === 2 && '✓'}</p>
                  <img src={enhancedUrl2} alt="Result 2" className="w-full rounded-b-lg" />
                </div>
              </div>
              
              {selectedResult && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold mb-2">Before & After:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <img src={previewUrl} alt="Before" className="w-full rounded-lg border" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <img 
                        src={selectedResult === 1 ? enhancedUrl1 : enhancedUrl2} 
                        alt="After" 
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
