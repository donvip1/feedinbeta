import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { callId, callType, expiresInMinutes = 60 } = await req.json();

    if (!callId) {
      return new Response(
        JSON.stringify({ error: "callId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    
    // Ensure code is unique
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('call_invites')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();
      
      if (!existing) break;
      
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    // Insert invite with call_type
    const { data: invite, error: insertError } = await supabase
      .from('call_invites')
      .insert({
        call_id: callId,
        invite_code: inviteCode,
        created_by: user.id,
        expires_at: expiresAt,
        call_type: callType || 'video',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[create-call-invite] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the app URL from request origin or use a default
    const origin = req.headers.get('origin') || 'https://app.example.com';
    const inviteLink = `${origin}/call/join/${inviteCode}`;

    console.log(`[create-call-invite] Created invite ${inviteCode} for call ${callId}`);

    return new Response(
      JSON.stringify({
        inviteCode,
        inviteLink,
        expiresAt,
        callId,
        callType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[create-call-invite] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});