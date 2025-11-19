import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation
const validateInput = (data: any) => {
  const { action, transactionId, proofUrl } = data;
  
  const validActions = ["create_transaction", "upload_proof", "confirm_payment", "cancel_transaction"];
  if (!validActions.includes(action)) {
    throw new Error("Invalid action");
  }
  
  if (!transactionId || typeof transactionId !== "string") {
    throw new Error("Invalid transactionId");
  }
  
  if (action === "upload_proof") {
    if (!proofUrl || typeof proofUrl !== "string" || proofUrl.length > 500) {
      throw new Error("Invalid proofUrl");
    }
  }
  
  return { action, transactionId, proofUrl };
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
    const { action, transactionId, proofUrl } = validateInput(requestData);
    
    // Use authenticated user ID
    const userId = user.id;

    // Get transaction details
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

        // Use service role only for escrow operations
        const supabaseService = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

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

        // Use service role for credit transfer
        const supabaseService = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

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

        // Use service role for refund
        const supabaseService = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Refund credits to seller
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "refund",
          amount: transaction.credits_amount,
          description: "P2P transaction cancelled - escrow refund",
          related_id: transactionId,
        });

        // Update escrow and transaction
        await supabase
          .from("p2p_escrow")
          .update({ status: "refunded" })
          .eq("transaction_id", transactionId);

        await supabase
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
