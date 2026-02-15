import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = new TextEncoder().encode(secret);
  const data = new TextEncoder().encode(body);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hash = new TextDecoder().decode(encode(new Uint8Array(sig)));
  return hash === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    // Verify webhook signature
    const isValid = await verifySignature(body, signature, paystackSecretKey);
    if (!isValid) {
      console.error('Invalid Paystack webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event);

    if (event.event !== 'charge.success') {
      // Acknowledge non-charge events
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const txData = event.data;
    const metadata = txData.metadata || {};
    const userId = metadata.user_id;
    const reference = txData.reference;

    if (!userId) {
      console.error('No user_id in webhook metadata');
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for server-side operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if this reference was already processed
    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('stripe_payment_intent_id', reference)
      .maybeSingle();

    if (existingTx) {
      console.log('Reference already processed:', reference);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (metadata.type === 'credits') {
      const totalCredits = parseInt(metadata.credits);
      
      // Use raw SQL via rpc since service role
      const { error: rpcError } = await supabase.rpc('add_credits_from_purchase', {
        p_user_id: userId,
        p_amount: totalCredits,
        p_description: metadata.description || 'Credit purchase via Paystack',
        p_reference: reference,
      });

      if (rpcError) {
        console.error('Credit RPC error:', rpcError);
        throw new Error('Failed to add credits');
      }

      // Update highest tier level
      if (metadata.package_id) {
        const { data: pkg } = await supabase
          .from('credit_packages')
          .select('tier_level')
          .eq('id', metadata.package_id)
          .single();

        if (pkg?.tier_level) {
          const { data: currentCredits } = await supabase
            .from('user_credits')
            .select('highest_tier_level')
            .eq('user_id', userId)
            .single();

          if ((currentCredits?.highest_tier_level ?? 0) < pkg.tier_level) {
            await supabase
              .from('user_credits')
              .update({ highest_tier_level: pkg.tier_level })
              .eq('user_id', userId);
          }
        }
      }

      console.log(`Credited ${totalCredits} to user ${userId} via webhook`);

    } else if (metadata.type === 'subscription') {
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          tier_id: metadata.tier_id,
          status: 'active',
          payment_provider: 'paystack',
          paystack_reference: reference,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' });

      if (subError) {
        console.error('Subscription upsert error:', subError);
        throw new Error('Failed to activate subscription');
      }

      // Grant subscription credits
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('subscription_credits, name')
        .eq('id', metadata.tier_id)
        .single();

      if (tier?.subscription_credits && tier.subscription_credits > 0) {
        await supabase.rpc('add_credits_from_purchase', {
          p_user_id: userId,
          p_amount: tier.subscription_credits,
          p_description: `${tier.name} subscription credits`,
          p_reference: reference,
        });
      }

      console.log(`Activated subscription for user ${userId} via webhook`);
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
