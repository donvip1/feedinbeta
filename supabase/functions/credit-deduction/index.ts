import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const validateInput = (data: any) => {
  const { action, targetUserId, metadata } = data;
  
  const validActions = ["friend_request", "profile_view", "voice_call", "video_call"];
  if (!validActions.includes(action)) {
    throw new Error("Invalid action type");
  }
  
  if (targetUserId && typeof targetUserId !== "string") {
    throw new Error("Invalid targetUserId");
  }
  
  if (metadata) {
    if (metadata.minutes !== undefined) {
      const minutes = Number(metadata.minutes);
      if (isNaN(minutes) || minutes <= 0 || minutes > 120) {
        throw new Error("Invalid minutes value");
      }
    }
    if (metadata.username && typeof metadata.username !== "string") {
      throw new Error("Invalid username");
    }
  }
  
  return { action, targetUserId, metadata };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input (no userId accepted from client)
    const requestData = await req.json();
    const { action, targetUserId, metadata } = validateInput(requestData);
    
    // Use authenticated user ID
    const userId = user.id;

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
    }

    // Check if user has enough credits
    const { data: userCredits } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (!userCredits || userCredits.balance < Math.abs(amount)) {
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

    console.log(`Credit deduction: user=${userId}, action=${action}, amount=${amount}`);

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
