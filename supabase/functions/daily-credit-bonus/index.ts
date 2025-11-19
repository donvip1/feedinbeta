import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-function-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Secret-based authentication for scheduled jobs
    const secret = req.headers.get("x-function-secret");
    const expectedSecret = Deno.env.get("DAILY_BONUS_SECRET") || "default-secret-change-me";
    
    if (secret !== expectedSecret) {
      console.error("Unauthorized access attempt to daily-credit-bonus");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting daily credit bonus distribution...");

    // Get all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("user_subscriptions")
      .select(`
        user_id,
        tier_id,
        created_at,
        current_period_end,
        subscription_tiers(name, price)
      `)
      .eq("status", "active");

    if (subError) throw subError;

    let processedCount = 0;
    let errorCount = 0;

    for (const sub of subscriptions || []) {
      try {
        const tier = Array.isArray(sub.subscription_tiers) ? sub.subscription_tiers[0] : sub.subscription_tiers;
        const tierName = tier?.name;
        const tierPrice = tier?.price;
        const daysSinceStart = Math.floor(
          (Date.now() - new Date(sub.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        let dailyBonus = 0;
        let maxDays = 0;

        // Determine bonus based on tier and price
        if (tierName === "Basic") {
          if (tierPrice === 1) {
            dailyBonus = 2;
            maxDays = 7;
          } else if (tierPrice === 5 || tierPrice === 10) {
            dailyBonus = 2;
            maxDays = 14;
          }
        } else if (tierName === "Pro") {
          dailyBonus = 5;
          maxDays = 30;
        } else if (tierName === "Premium") {
          dailyBonus = 7;
          maxDays = 90;
        }

        // Only give bonus if within the bonus period
        if (dailyBonus > 0 && daysSinceStart < maxDays) {
          const { error: transactionError } = await supabase
            .from("credit_transactions")
            .insert({
              user_id: sub.user_id,
              type: "bonus",
              amount: dailyBonus,
              description: `Daily ${tierName} tier bonus`,
            });

          if (transactionError) {
            console.error(`Error for user ${sub.user_id}:`, transactionError);
            errorCount++;
          } else {
            processedCount++;
          }
        }
      } catch (err) {
        console.error("Error processing subscription:", err);
        errorCount++;
      }
    }

    console.log(`Processed ${processedCount} bonuses, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        errors: errorCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Daily bonus error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
