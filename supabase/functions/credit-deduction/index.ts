import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit costs per action
const COSTS: Record<string, number> = {
  friend_request: 5,
  profile_view: 2,
  voice_call: 20,  // per minute
  video_call: 30,  // per minute
  ai_tool: 0,      // Variable cost passed in metadata
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for all DB operations (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verify user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, targetUserId, metadata, callId } = await req.json();

    // Validate action type
    const costPerUnit = COSTS[action];
    if (costPerUnit === undefined) {
      return new Response(
        JSON.stringify({ error: "Invalid action type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate total cost
    let totalCost = costPerUnit;
    let description = "";

    switch (action) {
      case "friend_request":
        description = `Friend request sent`;
        break;
      case "profile_view":
        description = `Viewed profile${metadata?.username ? ` of ${metadata.username}` : ""}`;
        break;
      case "voice_call":
      case "video_call":
        const minutes = Math.max(1, Math.min(120, Number(metadata?.minutes) || 1));
        const duration = Number(metadata?.duration) || minutes * 60;
        totalCost = costPerUnit * minutes;
        const otherUserName = metadata?.otherUserName || 'Unknown';
        description = `${action === "video_call" ? "Video" : "Voice"} call with ${otherUserName} - ${minutes} min`;
        break;
      case "ai_tool":
        // Variable cost passed from frontend
        totalCost = Number(metadata?.credits) || 5;
        const toolName = metadata?.tool || 'AI Tool';
        description = `Used ${toolName.replace(/_/g, ' ')}`;
        break;
    }

    // Check user balance
    const { data: credits, error: creditError } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (creditError || !credits) {
      console.log(`[Credit] No credits found for user ${user.id}`);
      return new Response(
        JSON.stringify({ success: false, error: "No credit account found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (credits.balance < totalCost) {
      console.log(`[Credit] Insufficient: has ${credits.balance}, needs ${totalCost}`);
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient credits" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert transaction (triggers will update balance)
    const { error: txError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -totalCost,
        description,
        type: "spent",
        related_id: callId || targetUserId || null,
      });

    if (txError) {
      console.error("[Credit] Transaction error:", txError);
      throw txError;
    }

    // Update call_logs with credits_deducted if this is a call
    if (callId && (action === "voice_call" || action === "video_call")) {
      const { error: callUpdateError } = await supabase
        .from("call_logs")
        .update({ credits_deducted: totalCost })
        .eq("id", callId);

      if (callUpdateError) {
        console.error("[Credit] Call log update error:", callUpdateError);
      } else {
        console.log(`[Credit] Updated call ${callId} with credits_deducted: ${totalCost}`);
      }
    }

    console.log(`[Credit] Deducted ${totalCost} from user ${user.id} for ${action}`);

    return new Response(
      JSON.stringify({ success: true, totalCost, description, callId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Credit] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
