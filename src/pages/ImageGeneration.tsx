import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Loader2, Share2, Sparkles, RefreshCw, Wand2, Palette, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from '@/components/navigation/BackButton';
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ImageShareModal } from "@/components/shared/ImageShareModal";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { motion, AnimatePresence } from "framer-motion";

const STYLE_PRESETS = [
  { id: 'realistic', label: 'Realistic', emoji: '📷', gradient: 'from-slate-500 to-zinc-600' },
  { id: 'artistic', label: 'Artistic', emoji: '🎨', gradient: 'from-purple-500 to-pink-500' },
  { id: 'anime', label: 'Anime', emoji: '🎌', gradient: 'from-pink-500 to-rose-500' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🐉', gradient: 'from-violet-500 to-purple-600' },
  { id: 'scifi', label: 'Sci-Fi', emoji: '🚀', gradient: 'from-cyan-500 to-blue-500' },
  { id: 'minimal', label: 'Minimal', emoji: '◻️', gradient: 'from-gray-400 to-slate-500' },
];

const EXAMPLE_PROMPTS = [
  "A futuristic cityscape at sunset with flying cars",
  "Mystical forest with glowing mushrooms and fireflies",
  "Astronaut floating in space with Earth in background",
  "Cozy coffee shop interior on a rainy day",
];

export default function ImageGeneration() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { progress, isUploading, startUpload, updateProgress, completeUpload, failUpload } = useUploadProgress();
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("realistic");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

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
    startUpload();
    try {
      updateProgress(10);
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
      updateProgress(30);

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

      updateProgress(50);
      
      // Enhance prompt with style
      const stylePreset = STYLE_PRESETS.find(s => s.id === selectedStyle);
      const enhancedPrompt = `${prompt}, ${selectedStyle} style, high quality, detailed`;
      
      const { data, error } = await supabase.functions.invoke("ai-image-gen", {
        body: { prompt: enhancedPrompt, mode: "generate" }
      });

      if (error) throw error;
      updateProgress(80);

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        updateProgress(90);

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

        completeUpload();
        toast({ title: "Image generated successfully!" });
      }
    } catch (error: any) {
      console.error("Error:", error);
      failUpload(error.message);
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <BackButton fallback="/ai/copilot" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Palette className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold">Image Generation</h1>
            <Badge className="bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[10px] px-1.5">
              AI
            </Badge>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-rose-600/5" />
            <CardContent className="relative p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-5 h-5 text-pink-500" />
                <span className="font-medium">Describe Your Image</span>
              </div>
              
              <Textarea
                placeholder="E.g., 'A futuristic cityscape at sunset with flying cars'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px] bg-background/50"
              />

              {/* Style Selection */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Choose Style</span>
                <div className="grid grid-cols-3 gap-2">
                  {STYLE_PRESETS.map((style) => (
                    <motion.button
                      key={style.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-2 rounded-xl border-2 transition-all text-center ${
                        selectedStyle === style.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 hover:border-primary/30 bg-card/50'
                      }`}
                    >
                      <span className="text-xl mb-1 block">{style.emoji}</span>
                      <span className="text-xs font-medium">{style.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Example Prompts */}
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Try these:</span>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((example, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPrompt(example)}
                      className="text-xs px-2 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {example.length > 35 ? example.slice(0, 35) + '...' : example}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Generating...</span>
                    <span className="text-primary font-medium">{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              <Button 
                onClick={handleGenerate} 
                disabled={loading} 
                className="w-full h-12 font-semibold bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Image...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Generate Image
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Generated Image */}
        <AnimatePresence mode="wait">
          {imageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="overflow-hidden border-border/50">
                <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                  <span className="font-semibold">Generated Image</span>
                  <Badge variant="secondary" className="ml-auto capitalize">
                    {selectedStyle}
                  </Badge>
                </div>
                <div className="p-4">
                  <motion.img 
                    src={imageUrl} 
                    alt="Generated" 
                    className="w-full rounded-xl shadow-lg"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </Card>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowShareModal(true)} 
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button 
                  onClick={() => {
                    setImageUrl("");
                    setPrompt("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        <AnimatePresence>
          {!imageUrl && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Image Generator</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Describe any image you can imagine and watch AI bring it to life in seconds
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ImageShareModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        imageUrl={imageUrl}
        imageType="generated"
      />

      <BottomNav />
    </div>
  );
}
