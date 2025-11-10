import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, userId, targetUserId, metadata } = await req.json();

    // Define credit costs
    const COSTS = {
      friend_request: 5,
      profile_view: 2,
      voice_call_per_min: 20,
      video_call_per_min: 30,
    };

    let amount = 0;
    let description = "";

    switch (action) {
      case "friend_request":
        amount = -COSTS.friend_request;
        description = "Friend request sent";
        break;
      case "profile_view":
        amount = -COSTS.profile_view;
        description = `Viewed profile of ${metadata?.username || "user"}`;
        break;
      case "voice_call":
        amount = -(COSTS.voice_call_per_min * (metadata?.minutes || 1));
        description = `Voice call - ${metadata?.minutes || 1} minutes`;
        break;
      case "video_call":
        amount = -(COSTS.video_call_per_min * (metadata?.minutes || 1));
        description = `Video call - ${metadata?.minutes || 1} minutes`;
        break;
      default:
        throw new Error("Invalid action type");
    }

    // Check if user has enough credits
    const { data: userCredits } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (!userCredits || userCredits.balance < Math.abs(amount)) {
      // For non-blocking actions like profile views, don't return an HTTP error
      if (action === "profile_view") {
        return new Response(
          JSON.stringify({ success: false, error: "Insufficient credits" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct credits
    const { error: transactionError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: userId,
        type: "deduction",
        amount,
        description,
        related_id: targetUserId,
      });

    if (transactionError) throw transactionError;

    return new Response(
      JSON.stringify({ success: true, amount, description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Credit deduction error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
