import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/navigation/BottomNav";

export default function EducationalQA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!user) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    if (!question.trim()) {
      toast({ title: "Please enter a question", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check credits and limits
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_ai_eduqa_count, last_ai_reset")
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
        const currentCount = lastReset === today ? profile?.daily_ai_eduqa_count || 0 : 0;

        if (currentCount >= 5) {
          if (!credits || credits.balance < 5) {
            toast({
              title: "Daily limit reached",
              description: "You need 5 credits to continue or wait until tomorrow",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
        }
      }

      // Generate answer
      const systemPrompt = `You are an expert educator and tutor. Provide clear, detailed, and accurate answers to educational questions. 
Include:
- Direct answer to the question
- Detailed explanation
- Examples if relevant
- Additional context or related concepts
- Tips for understanding the topic better

Use simple language and break down complex concepts.`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
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
        const currentCount = lastReset === today ? profile?.daily_ai_eduqa_count || 0 : 0;

        if (currentCount >= 5 && credits && credits.balance >= 5) {
          await supabase.from("credit_transactions").insert({
            user_id: user.id,
            amount: -5,
            transaction_type: "ai_generation",
            description: "Educational Q&A"
          });
        }

        await supabase
          .from("profiles")
          .update({
            daily_ai_eduqa_count: currentCount + 1,
            last_ai_reset: new Date().toISOString()
          })
          .eq("id", user.id);
      }

      toast({ title: "Answer generated successfully!" });
    } catch (error: any) {
      console.error("Error:", error);
      toast({ title: "Failed to get answer", description: error.message, variant: "destructive" });
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
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Educational Q&A</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-sm text-muted-foreground mb-4">
            Ask any educational question and get detailed, easy-to-understand answers. (5 questions per day free)
          </p>
          <Textarea
            placeholder="E.g., 'Explain photosynthesis in simple terms' or 'How does blockchain work?'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[120px] mb-4"
          />
          <Button onClick={handleAsk} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Getting Answer...
              </>
            ) : (
              "Get Answer"
            )}
          </Button>
        </div>

        {result && (
          <div className="bg-card rounded-lg p-4 border">
            <h3 className="font-semibold mb-3">Answer:</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
