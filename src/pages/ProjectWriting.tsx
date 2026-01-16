import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";
import { MarkdownRenderer } from "@/components/ai/MarkdownRenderer";

export default function ProjectWriting() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    if (!prompt.trim()) {
      toast({ title: "Please enter a project description", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check credits and limits
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

      // Generate project
      const systemPrompt = `You are an expert project writer and planner. Create a comprehensive project document based on the user's description. Include:
- Executive Summary
- Project Objectives
- Scope and Deliverables
- Timeline and Milestones
- Resources Required
- Risk Assessment
- Implementation Plan
- Expected Outcomes
- Budget Considerations

Use professional language and industry best practices.`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
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

      // Deduct credits if needed
      if (!isAdmin) {
        const today = new Date().toDateString();
        const lastReset = profile?.last_ai_reset ? new Date(profile.last_ai_reset).toDateString() : null;
        const currentCount = lastReset === today ? profile?.daily_ai_thesis_count || 0 : 0;

        if (currentCount >= 1 && credits && credits.balance >= 20) {
          await supabase.from("credit_transactions").insert({
            user_id: user.id,
            amount: -20,
            type: "ai_generation",
            description: "Project writing"
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

      toast({ title: "Project document generated successfully!" });
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
            <FolderOpen className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Project Writing</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-4">
            Describe your project and get a complete professional project document with objectives, timeline, and implementation plan.
          </p>
          <Textarea
            placeholder="E.g., 'Mobile app development project for food delivery service targeting college students'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] mb-4"
          />
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Project"
            )}
          </Button>
        </div>

        {result && (
          <div className="bg-card rounded-lg p-4 border">
            <h3 className="font-semibold mb-3">Project Document:</h3>
            <MarkdownRenderer content={result} />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
