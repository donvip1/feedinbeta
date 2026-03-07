import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { streamId } = await req.json();
    if (!streamId) {
      return new Response(JSON.stringify({ error: "streamId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch last 15 minutes of chat messages
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: messages, error: msgError } = await supabase
      .from("live_stream_messages")
      .select("content, created_at")
      .eq("stream_id", streamId)
      .gte("created_at", fifteenMinsAgo)
      .order("created_at", { ascending: true })
      .limit(200);

    if (msgError) {
      console.error("Error fetching messages:", msgError);
    }

    const chatLog = (messages || []).map((m: any) => m.content).join("\n");

    if (!chatLog.trim()) {
      return new Response(
        JSON.stringify({ bullets: ["No recent chat activity to summarize."], pinnedLinks: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a live stream assistant. Summarize chat conversations into concise bullet points and extract any URLs mentioned.",
          },
          {
            role: "user",
            content: `Summarize the following live stream chat from the last 15 minutes into 3 key bullet points. Also extract any URLs/links mentioned.\n\nChat log:\n${chatLog}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "stream_summary",
              description: "Return a structured summary of the live stream chat",
              parameters: {
                type: "object",
                properties: {
                  bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 concise bullet point summaries of chat activity",
                  },
                  pinnedLinks: {
                    type: "array",
                    items: { type: "string" },
                    description: "URLs or links mentioned in the chat",
                  },
                },
                required: ["bullets", "pinnedLinks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "stream_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback if no tool call
    const fallbackContent = aiData.choices?.[0]?.message?.content || "";
    return new Response(
      JSON.stringify({ bullets: [fallbackContent || "Unable to generate summary."], pinnedLinks: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("stream-ai-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
