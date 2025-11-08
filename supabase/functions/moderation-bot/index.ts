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
    // Get auth token and validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messageId, content, senderId } = await req.json();

    // Verify authenticated user matches senderId (only moderate own messages)
    if (user.id !== senderId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - can only moderate own messages' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Phone number patterns (including smart spacing)
    const phonePatterns = [
      /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, // US format
      /\b\d{4}[\s-]?\d{3}[\s-]?\d{4}\b/g, // International
      /\b\+?\d{1,3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, // With country code
      /\b0\d{2}[\s-]?\d{4}[\s-]?\d{4}\b/g, // UK/Nigerian format
      /\b\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d[\s.,-]\d\b/g, // Smart spacing
    ];

    // URL patterns (including disguised)
    const urlPatterns = [
      /https?:\/\/[^\s]+/gi,
      /www\.[^\s]+/gi,
      /\b[a-z0-9-]+\.(com|net|org|io|co|uk)\b/gi,
      /[a-z0-9-]+\s*\.\s*(com|net|org|io|co|uk)/gi, // Spaced dots
      /[a-z0-9-]+\[dot\](com|net|org|io|co|uk)/gi, // [dot] disguise
    ];

    let isViolation = false;
    let violationType = "";

    // Check for phone numbers
    for (const pattern of phonePatterns) {
      if (pattern.test(content)) {
        isViolation = true;
        violationType = "phone_number";
        break;
      }
    }

    // Check for URLs
    if (!isViolation) {
      for (const pattern of urlPatterns) {
        if (pattern.test(content)) {
          isViolation = true;
          violationType = "url";
          break;
        }
      }
    }

    if (isViolation) {
      // Check if sender has premium subscription
      const { data: subscription } = await supabaseAdmin
        .from("user_subscriptions")
        .select("tier_id, subscription_tiers(name)")
        .eq("user_id", senderId)
        .eq("status", "active")
        .single();

      const tier = Array.isArray(subscription?.subscription_tiers) 
        ? subscription.subscription_tiers[0] 
        : subscription?.subscription_tiers;
      
      const isPremium = subscription && 
        (tier?.name === "Pro" || tier?.name === "Premium");

      if (!isPremium) {
        // Delete the message
        const { error: deleteError } = await supabaseAdmin
          .from("messages")
          .delete()
          .eq("id", messageId);

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({
            deleted: true,
            reason: `Message contained ${violationType}. Only premium users can share contact information.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ deleted: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Moderation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});