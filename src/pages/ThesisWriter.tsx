import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, BookOpen, GraduationCap, Sparkles, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";
import { EnhancedMarkdownRenderer } from "@/components/ai/EnhancedMarkdownRenderer";
import { motion, AnimatePresence } from "framer-motion";

const EXAMPLE_TOPICS = [
  "The Impact of Social Media on Mental Health Among Teenagers",
  "Renewable Energy Solutions for Developing Countries",
  "Artificial Intelligence in Healthcare Diagnostics",
  "Climate Change Effects on Global Food Security",
];

export default function ThesisWriter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    if (!prompt.trim()) {
      toast({ title: "Please enter a topic", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_ai_thesis_count, last_ai_reset")
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
        const currentCount = lastReset === today ? profile?.daily_ai_thesis_count || 0 : 0;

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

      const systemPrompt = `You are an expert academic thesis writer with a PhD in research methodology. Create a comprehensive, well-structured thesis based on the user's topic.

## Response Formatting (CRITICAL):

### Structure Requirements:
1. **Abstract** - Concise summary (150-300 words)
2. **Introduction** - Context, problem statement, objectives
3. **Literature Review** - Key theories and existing research
4. **Methodology** - Research design and methods
5. **Main Body** - Organized into clear chapters/sections
6. **Conclusion** - Key findings and implications
7. **References** - Proper APA/MLA format

### Formatting Rules:
- Use **bold** for key terms and concepts
- Use proper headings hierarchy (# ## ###)
- Include bullet points for lists
- Add blockquotes for important citations
- Use tables when comparing data or concepts
- Include numbered lists for sequential steps

### Academic Standards:
- Formal academic language throughout
- Clear thesis statement in introduction
- Logical flow between sections
- Evidence-based arguments
- Critical analysis of sources`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write a comprehensive academic thesis on: ${prompt}` }
          ]
        }
      });

      if (error) throw error;

      let fullResponse = "";
      const reader = data.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                setResult(fullResponse);
              }
            } catch {}
          }
        }
      }

      if (!isAdmin) {
        const today = new Date().toDateString();
        const lastReset = profile?.last_ai_reset ? new Date(profile.last_ai_reset).toDateString() : null;
        const currentCount = lastReset === today ? profile?.daily_ai_thesis_count || 0 : 0;

        if (currentCount >= 1 && credits && credits.balance >= 20) {
          await supabase.from("credit_transactions").insert({
            user_id: user.id,
            amount: -20,
            type: "ai_generation",
            description: "Thesis generation"
          });
        }

        await supabase
          .from("profiles")
          .update({
            daily_ai_thesis_count: currentCount + 1,
            last_ai_reset: new Date().toISOString()
          })
          .eq("id", user.id);
      }

      toast({ title: "Thesis generated successfully!" });
    } catch (error: any) {
      console.error("Error:", error);
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold">Thesis Writer</h1>
            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] px-1.5">
              Pro
            </Badge>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-600/5" />
            <CardContent className="relative p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span className="font-medium">Enter Your Thesis Topic</span>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Provide a clear, specific topic and let AI generate a comprehensive academic thesis for you.
              </p>

              <Textarea
                placeholder="E.g., 'The Impact of Social Media on Mental Health Among Teenagers'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] bg-background/50"
              />

              {/* Example Topics */}
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Example topics:</span>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_TOPICS.map((topic, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPrompt(topic)}
                      className="text-xs px-2 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {topic.length > 40 ? topic.slice(0, 40) + '...' : topic}
                    </motion.button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={loading} 
                className="w-full h-12 font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Thesis...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Thesis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Result Section */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-border/50 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <span className="font-semibold">Generated Thesis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="gap-2"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4 md:p-6">
                  <EnhancedMarkdownRenderer content={result} animate />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        <AnimatePresence>
          {!result && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Academic Thesis Generator</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Generate comprehensive, well-structured academic theses with proper formatting, citations, and scholarly language
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
