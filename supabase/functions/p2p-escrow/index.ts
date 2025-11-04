import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation helpers
const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidURL = (url: string) => {
  try {
    new URL(url);
    return url.length <= 2048; // Reasonable URL length limit
  } catch {
    return false;
  }
};

const validateInput = (data: any, action: string) => {
  if (!data.transactionId || !isValidUUID(data.transactionId)) {
    throw new Error('Invalid transaction ID format');
  }
  
  if (action === 'upload_proof' && (!data.proofUrl || !isValidURL(data.proofUrl))) {
    throw new Error('Invalid proof URL');
  }
  
  return data;
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
    
    // Create client with user's JWT for authentication
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
    const { action, transactionId, proofUrl } = validateInput(requestData, requestData.action);

    // Get transaction details using service role for escrow operations
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: transaction, error: txError } = await supabaseService
      .from("p2p_transactions")
      .select("*, p2p_listings(*)")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    switch (action) {
      case "create_transaction": {
        // Verify user is the buyer
        if (userId !== transaction.buyer_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: You are not the buyer of this transaction" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

        // Deduct credits from seller temporarily
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "escrow_lock",
          amount: -transaction.credits_amount,
          description: "Credits locked in P2P escrow",
          related_id: transactionId,
        });

        return new Response(
          JSON.stringify({ success: true, escrow }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "upload_proof": {
        // Verify user is the buyer
        if (userId !== transaction.buyer_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Only buyer can upload proof" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabaseService
          .from("p2p_transactions")
          .update({ status: "proof_uploaded", proof_url: proofUrl })
          .eq("id", transactionId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "confirm_payment": {
        // Verify user is the seller
        if (userId !== transaction.seller_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Only seller can confirm payment" }),
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

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_transaction": {
        // Verify user is buyer or seller
        if (userId !== transaction.buyer_id && userId !== transaction.seller_id) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: You are not part of this transaction" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Refund credits to seller
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "escrow_refund",
          amount: transaction.credits_amount,
          description: "P2P transaction cancelled - credits returned",
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
