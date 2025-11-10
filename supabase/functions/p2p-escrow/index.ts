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

    const { action, transactionId, userId, proofUrl } = await req.json();

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
        // Lock seller's credits in escrow
        const { data: escrow, error: escrowError } = await supabase
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
        await supabase.from("credit_transactions").insert({
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
        // Buyer uploads payment proof
        if (userId !== transaction.buyer_id) {
          throw new Error("Only buyer can upload proof");
        }

        await supabase
          .from("p2p_transactions")
          .update({ status: "proof_uploaded", proof_url: proofUrl })
          .eq("id", transactionId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "confirm_payment": {
        // Seller confirms payment received
        if (userId !== transaction.seller_id) {
          throw new Error("Only seller can confirm payment");
        }

        // Release credits to buyer
        await supabase.from("credit_transactions").insert({
          user_id: transaction.buyer_id,
          type: "p2p_purchase",
          amount: transaction.credits_amount,
          description: "Credits purchased via P2P marketplace",
          related_id: transactionId,
        });

        // Update escrow status
        await supabase
          .from("p2p_escrow")
          .update({ status: "released", released_at: new Date().toISOString() })
          .eq("transaction_id", transactionId);

        // Update transaction and listing
        await supabase
          .from("p2p_transactions")
          .update({ status: "completed", escrow_locked: false })
          .eq("id", transactionId);

        await supabase
          .from("p2p_listings")
          .update({ status: "sold" })
          .eq("id", transaction.listing_id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "cancel_transaction": {
        // Refund credits to seller
        await supabase.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "escrow_refund",
          amount: transaction.credits_amount,
          description: "P2P transaction cancelled - credits returned",
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
