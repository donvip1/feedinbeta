import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

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

    const { type, priceId, successUrl, cancelUrl } = await req.json();

    // Validate input type
    if (!type || !['subscription', 'credits'].includes(type)) {
      throw new Error('Invalid payment type');
    }

    if (!priceId || typeof priceId !== 'string') {
      throw new Error('Invalid price ID');
    }

    console.log('Creating checkout session for:', { type, priceId, userId: user.id });

    // Validate priceId against database and get metadata
    let metadata: Record<string, string> = {
      user_id: user.id,
      type: type,
    };

    if (type === 'subscription') {
      const { data: tier, error: tierError } = await supabaseClient
        .from('subscription_tiers')
        .select('id, stripe_price_id, name, price')
        .eq('stripe_price_id', priceId)
        .eq('is_active', true)
        .single();

      if (tierError || !tier) {
        console.error('Invalid subscription price ID:', priceId, tierError);
        throw new Error('Invalid subscription plan');
      }

      metadata.tier_id = tier.id;
      metadata.tier_name = tier.name;
      metadata.description = `${tier.name} subscription`;
    } else if (type === 'credits') {
      const { data: package_, error: packageError } = await supabaseClient
        .from('credit_packages')
        .select('id, stripe_price_id, credits, bonus_credits, name, price')
        .eq('stripe_price_id', priceId)
        .eq('is_active', true)
        .single();

      if (packageError || !package_) {
        console.error('Invalid credit package price ID:', priceId, packageError);
        throw new Error('Invalid credit package');
      }

      const totalCredits = package_.credits + (package_.bonus_credits || 0);
      metadata.package_id = package_.id;
      metadata.credits = totalCredits.toString();
      metadata.description = `${package_.name} - ${totalCredits} credits`;
    }

    // Get or create Stripe customer
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, display_name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create checkout session with validated metadata
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: type === 'subscription' ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Payment processing failed',
        code: 'CHECKOUT_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});