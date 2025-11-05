import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const validateInput = (data: any) => {
  const validActions = ['friend_request', 'profile_view', 'voice_call', 'video_call'];
  
  if (!data.action || !validActions.includes(data.action)) {
    throw new Error('Invalid action type');
  }
  
  if (data.targetUserId && !isValidUUID(data.targetUserId)) {
    throw new Error('Invalid target user ID');
  }
  
  if (data.metadata?.minutes && (!Number.isInteger(data.metadata.minutes) || data.metadata.minutes <= 0)) {
    throw new Error('Invalid minutes value');
  }
  
  if (data.metadata?.username && (typeof data.metadata.username !== 'string' || data.metadata.username.length > 100)) {
    throw new Error('Invalid username');
  }
  
  return data;
};

const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const requestData = await req.json();
    
    // Validate input
    const { action, targetUserId, metadata } = validateInput(requestData);

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
        type: "spent",
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
