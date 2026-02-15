import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { action, type, itemId, reference } = await req.json();

    // VERIFY payment action
    if (action === 'verify') {
      if (!reference) throw new Error('Missing payment reference');

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.status || verifyData.data.status !== 'success') {
        throw new Error('Payment verification failed');
      }

      const metadata = verifyData.data.metadata;

      if (metadata.type === 'credits') {
        // Credit the user
        const totalCredits = parseInt(metadata.credits);
        await supabaseClient.rpc('add_credits_from_purchase', {
          p_user_id: user.id,
          p_amount: totalCredits,
          p_description: metadata.description || 'Credit purchase via Paystack',
          p_reference: reference,
        });
      } else if (metadata.type === 'subscription') {
        // Create/update user subscription
        const { error: subError } = await supabaseClient
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
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
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // INITIALIZE payment action
    if (!type || !['subscription', 'credits'].includes(type)) {
      throw new Error('Invalid payment type');
    }
    if (!itemId) throw new Error('Missing item ID');

    let amount = 0; // in kobo (Paystack uses smallest currency unit)
    let metadata: Record<string, string> = { user_id: user.id, type };

    if (type === 'credits') {
      const { data: pkg, error } = await supabaseClient
        .from('credit_packages')
        .select('*')
        .eq('id', itemId)
        .eq('is_active', true)
        .single();

      if (error || !pkg) throw new Error('Invalid credit package');

      const totalCredits = pkg.credits + (pkg.bonus_credits || 0);
      amount = Math.round(pkg.price * 100); // USD cents → kobo equivalent
      metadata.package_id = pkg.id;
      metadata.credits = totalCredits.toString();
      metadata.description = `${pkg.name} - ${totalCredits} credits`;
    } else if (type === 'subscription') {
      const { data: tier, error } = await supabaseClient
        .from('subscription_tiers')
        .select('*')
        .eq('id', itemId)
        .eq('is_active', true)
        .single();

      if (error || !tier) throw new Error('Invalid subscription tier');

      amount = Math.round(tier.price * 100);
      metadata.tier_id = tier.id;
      metadata.tier_name = tier.name;
      metadata.description = `${tier.name} subscription`;
    }

    // Initialize Paystack transaction
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: 'USD',
        metadata,
        callback_url: `${req.headers.get('origin') || 'https://feedinbeta.lovable.app'}/${type === 'credits' ? 'credits' : 'subscription'}?reference=`,
      }),
    });

    const initData = await initRes.json();

    if (!initData.status) {
      console.error('Paystack init error:', initData);
      throw new Error(initData.message || 'Failed to initialize payment');
    }

    return new Response(
      JSON.stringify({
        authorization_url: initData.data.authorization_url,
        access_code: initData.data.access_code,
        reference: initData.data.reference,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Paystack error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Payment processing failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
