import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Strict validation schemas for metadata
const uuidSchema = z.string().uuid();
const creditsSchema = z.coerce.number().int().positive().max(1000000);
const typeSchema = z.enum(['subscription', 'credits']);

const checkoutMetadataSchema = z.object({
  user_id: uuidSchema,
  type: typeSchema,
  tier_id: uuidSchema.optional(),
  credits: z.string().regex(/^\d+$/).optional(),
  description: z.string().max(500).optional(),
});

serve(async (req) => {
  // Validate webhook secret is configured
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET not configured');
    return new Response(
      JSON.stringify({ error: 'Webhook not configured' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('Webhook request missing stripe-signature header');
    return new Response(
      JSON.stringify({ error: 'No signature' }), 
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log('Webhook event received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Validate metadata strictly
        const metadataResult = checkoutMetadataSchema.safeParse(session.metadata);
        if (!metadataResult.success) {
          console.error('Invalid checkout metadata:', metadataResult.error.errors);
          return new Response(
            JSON.stringify({ error: 'Invalid metadata format' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const { user_id: userId, type, tier_id: tierId, credits, description } = metadataResult.data;

        console.log('Checkout completed:', { userId, type, sessionId: session.id });

        if (type === 'subscription' && session.subscription) {
          // Validate tier_id is present for subscriptions
          if (!tierId) {
            console.error('Missing tier_id for subscription');
            return new Response(
              JSON.stringify({ error: 'Missing tier_id' }), 
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

          await supabaseAdmin.from('user_subscriptions').insert({
            user_id: userId,
            tier_id: tierId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          console.log('Subscription created for user:', userId);
        } else if (type === 'credits' && session.payment_intent) {
          // Validate and parse credits amount
          const creditsResult = creditsSchema.safeParse(credits);
          if (!creditsResult.success) {
            console.error('Invalid credits amount:', credits);
            return new Response(
              JSON.stringify({ error: 'Invalid credits amount' }), 
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const creditsAmount = creditsResult.data;
          
          await supabaseAdmin.from('credit_transactions').insert({
            user_id: userId,
            amount: creditsAmount,
            type: 'purchase',
            description: `Purchased ${creditsAmount} credits`,
            stripe_payment_intent_id: session.payment_intent as string,
          });

          console.log('Credits added for user:', userId, creditsAmount);
        }

        // Record payment with validated data
        await supabaseAdmin.from('payment_history').insert({
          user_id: userId,
          stripe_payment_intent_id: session.payment_intent as string,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || 'usd',
          status: 'succeeded',
          description: description || 'Payment',
          type: type,
        });

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        console.log('Subscription updated:', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);

        console.log('Subscription canceled:', subscription.id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR'
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});