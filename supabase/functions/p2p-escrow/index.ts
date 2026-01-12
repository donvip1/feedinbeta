import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// P2P Configuration
const P2P_CONFIG = {
  SELL_RATE: 85, // 85 credits = $1 USD for selling
  MIN_TRADE_FIRST_TIME: 500,
  MIN_TRADE_REGULAR: 100,
};

// Input validation
const validateInput = (data: any) => {
  const { action, transactionId, proofUrl, listingId } = data;
  
  const validActions = ["validate_listing", "create_transaction", "upload_proof", "confirm_payment", "cancel_transaction"];
  if (!validActions.includes(action)) {
    throw new Error("Invalid action");
  }
  
  if (action === "validate_listing") {
    if (!listingId || typeof listingId !== "string") {
      throw new Error("Invalid listingId");
    }
    return { action, listingId };
  }
  
  if (!transactionId || typeof transactionId !== "string") {
    throw new Error("Invalid transactionId");
  }
  
  if (action === "upload_proof") {
    if (!proofUrl || typeof proofUrl !== "string" || proofUrl.length > 500) {
      throw new Error("Invalid proofUrl");
    }
  }
  
  return { action, transactionId, proofUrl, listingId };
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
    
    // Use anon key with user's JWT for RLS enforcement
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input (no userId accepted from client)
    const requestData = await req.json();
    const { action, transactionId, proofUrl, listingId } = validateInput(requestData);
    
    // Use authenticated user ID
    const userId = user.id;

    // Service client for admin operations
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Helper function to check user eligibility
    const checkUserEligibility = async (userId: string) => {
      // Check if user has payment method
      const { data: paymentMethods } = await supabaseService
        .from("p2p_payment_methods")
        .select("id, country_code")
        .eq("user_id", userId)
        .eq("is_active", true);
      
      if (!paymentMethods || paymentMethods.length === 0) {
        throw new Error("Please add a payment method before trading");
      }

      // Get user's country from profile
      const { data: profile } = await supabaseService
        .from("profiles")
        .select("country")
        .eq("id", userId)
        .single();

      if (!profile?.country) {
        throw new Error("Please set your country in profile settings");
      }

      // Check eligibility status
      const { data: eligibility } = await supabaseService
        .from("p2p_user_eligibility")
        .select("*")
        .eq("user_id", userId)
        .single();

      const hasPurchasedPack = eligibility?.has_purchased_pack ?? false;
      const hasCompletedFirstTrade = eligibility?.first_p2p_trade_completed ?? false;
      const minTradeAmount = (hasPurchasedPack || hasCompletedFirstTrade) 
        ? P2P_CONFIG.MIN_TRADE_REGULAR 
        : P2P_CONFIG.MIN_TRADE_FIRST_TIME;

      return {
        userCountry: profile.country,
        paymentMethodCountry: paymentMethods[0].country_code,
        minTradeAmount,
        hasPurchasedPack,
        hasCompletedFirstTrade,
      };
    };

    // Handle validate_listing action
    if (action === "validate_listing") {
      const eligibility = await checkUserEligibility(userId);
      
      // Get listing details
      const { data: listing, error: listingError } = await supabase
        .from("p2p_listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (listingError || !listing) {
        throw new Error("Listing not found");
      }

      // Check region lock
      if (listing.country_code !== eligibility.userCountry && !listing.is_international) {
        return new Response(
          JSON.stringify({ 
            error: "Region locked", 
            message: "This listing is only available for users in the same country" 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check minimum trade amount
      if (listing.credits_amount < eligibility.minTradeAmount) {
        return new Response(
          JSON.stringify({ 
            error: "Below minimum", 
            message: `Minimum trade amount is ${eligibility.minTradeAmount} credits`,
            minTradeAmount: eligibility.minTradeAmount
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          eligibility,
          listing: {
            id: listing.id,
            credits_amount: listing.credits_amount,
            price_usd: listing.price_usd,
            country_code: listing.country_code,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get transaction details for other actions
    const { data: transaction, error: txError } = await supabase
      .from("p2p_transactions")
      .select("*, p2p_listings(*)")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    switch (action) {
      case "create_transaction": {
        // Verify user is the seller
        if (userId !== transaction.seller_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: not the seller" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check seller eligibility
        const sellerEligibility = await checkUserEligibility(transaction.seller_id);
        
        // Check buyer eligibility
        const buyerEligibility = await checkUserEligibility(transaction.buyer_id);

        // Verify both users are in the same country (region lock)
        if (sellerEligibility.userCountry !== buyerEligibility.userCountry) {
          return new Response(
            JSON.stringify({ 
              error: "Region mismatch", 
              message: "Buyer and seller must be in the same country" 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check minimum trade amount for buyer
        if (transaction.credits_amount < buyerEligibility.minTradeAmount) {
          return new Response(
            JSON.stringify({ 
              error: "Below minimum", 
              message: `Buyer's minimum trade amount is ${buyerEligibility.minTradeAmount} credits` 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Lock seller's credits in escrow
        const { data: escrow, error: escrowError } = await supabaseService
          .from("p2p_escrow")
          .insert({
            transaction_id: transactionId,
            credits_amount: transaction.credits_amount,
            status: "locked",
          })
          .select()
          .single();

        if (escrowError) throw escrowError;

        // Deduct credits from seller
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "escrow_lock",
          amount: -transaction.credits_amount,
          description: "Credits locked in P2P escrow",
          related_id: transactionId,
        });

        console.log(`Escrow created: transaction=${transactionId}, seller=${userId}`);

        return new Response(
          JSON.stringify({ success: true, escrow }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "upload_proof": {
        // Verify user is the buyer
        if (userId !== transaction.buyer_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: only buyer can upload proof" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from("p2p_transactions")
          .update({ status: "proof_uploaded", proof_url: proofUrl })
          .eq("id", transactionId);

        console.log(`Proof uploaded: transaction=${transactionId}, buyer=${userId}`);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "confirm_payment": {
        // Verify user is the seller
        if (userId !== transaction.seller_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: only seller can confirm" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Release credits to buyer
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.buyer_id,
          type: "p2p_purchase",
          amount: transaction.credits_amount,
          description: "Credits purchased via P2P marketplace",
          related_id: transactionId,
        });

        // Update escrow status
        await supabaseService
          .from("p2p_escrow")
          .update({ status: "released", released_at: new Date().toISOString() })
          .eq("transaction_id", transactionId);

        // Update transaction and listing
        await supabaseService
          .from("p2p_transactions")
          .update({ status: "completed", escrow_locked: false })
          .eq("id", transactionId);

        await supabaseService
          .from("p2p_listings")
          .update({ status: "sold" })
          .eq("id", transaction.listing_id);

        // Update buyer's eligibility (first trade completed)
        await supabaseService
          .from("p2p_user_eligibility")
          .upsert({
            user_id: transaction.buyer_id,
            first_p2p_trade_completed: true,
            total_trades: 1,
            total_volume_usd: transaction.price_usd,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        // Update seller's eligibility
        const { data: sellerEligibility } = await supabaseService
          .from("p2p_user_eligibility")
          .select("total_trades, total_volume_usd")
          .eq("user_id", transaction.seller_id)
          .single();

        await supabaseService
          .from("p2p_user_eligibility")
          .upsert({
            user_id: transaction.seller_id,
            first_p2p_trade_completed: true,
            total_trades: (sellerEligibility?.total_trades ?? 0) + 1,
            total_volume_usd: (parseFloat(sellerEligibility?.total_volume_usd?.toString() ?? "0")) + transaction.price_usd,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        console.log(`Payment confirmed: transaction=${transactionId}, seller=${userId}`);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_transaction": {
        // Verify user is involved in transaction
        if (userId !== transaction.buyer_id && userId !== transaction.seller_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Refund credits to seller
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "refund",
          amount: transaction.credits_amount,
          description: "P2P transaction cancelled - escrow refund",
          related_id: transactionId,
        });

        // Update escrow and transaction
        await supabaseService
          .from("p2p_escrow")
          .update({ status: "refunded" })
          .eq("transaction_id", transactionId);

        await supabaseService
          .from("p2p_transactions")
          .update({ status: "cancelled", escrow_locked: false })
          .eq("id", transactionId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error: any) {
    console.error("P2P escrow error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});