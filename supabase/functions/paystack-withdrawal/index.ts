import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_BASE = 'https://api.paystack.co';
const CREDITS_PER_USD = 100;
const PLATFORM_FEE_PERCENT = 30;
const MIN_WITHDRAWAL_CREDITS = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) throw new Error('PAYSTACK_SECRET_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Get user from auth header
    const authHeader = req.headers.get('Authorization') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { action, ...params } = await req.json();

    // ─── LIST BANKS ───
    if (action === 'list-banks') {
      const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── VERIFY ACCOUNT ───
    if (action === 'verify-account') {
      const { account_number, bank_code } = params;
      if (!account_number || !bank_code) {
        return new Response(JSON.stringify({ error: 'account_number and bank_code required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const res = await fetch(
        `${PAYSTACK_BASE}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
        { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── SAVE BANK ACCOUNT ───
    if (action === 'save-bank-account') {
      const { bank_code, bank_name, account_number, account_name } = params;
      if (!bank_code || !bank_name || !account_number || !account_name) {
        return new Response(JSON.stringify({ error: 'All bank fields required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Reset default flag on other accounts
      await serviceClient
        .from('user_bank_accounts')
        .update({ is_default: false })
        .eq('user_id', user.id);

      const { data: account, error: insertErr } = await serviceClient
        .from('user_bank_accounts')
        .insert({
          user_id: user.id,
          bank_code,
          bank_name,
          account_number,
          account_name,
          is_verified: true,
          is_default: true,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true, account }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── REQUEST WITHDRAWAL ───
    if (action === 'request-withdrawal') {
      const { credit_amount, bank_account_id } = params;

      if (!credit_amount || credit_amount < MIN_WITHDRAWAL_CREDITS) {
        return new Response(JSON.stringify({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL_CREDITS} credits` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get bank account
      const { data: bankAccount, error: bankErr } = await serviceClient
        .from('user_bank_accounts')
        .select('*')
        .eq('id', bank_account_id)
        .eq('user_id', user.id)
        .single();

      if (bankErr || !bankAccount) {
        return new Response(JSON.stringify({ error: 'Bank account not found' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate fees
      const platformFeeCredits = Math.floor(credit_amount * PLATFORM_FEE_PERCENT / 100);
      const netCredits = credit_amount - platformFeeCredits;
      const netUsd = netCredits / CREDITS_PER_USD;

      // Get NGN exchange rate
      const { data: rateRow } = await serviceClient
        .from('exchange_rates')
        .select('rate')
        .eq('currency_code', 'NGN')
        .single();

      const ngnRate = rateRow?.rate || 1500;
      const amountNgn = Math.round(netUsd * ngnRate * 100) / 100;
      const amountKobo = Math.round(amountNgn * 100);

      // Deduct credits atomically
      const { error: deductErr } = await serviceClient.rpc('deduct_credits_for_withdrawal', {
        p_user_id: user.id,
        p_amount: credit_amount,
      });

      if (deductErr) {
        return new Response(JSON.stringify({ error: deductErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Record platform fee revenue
      await serviceClient.rpc('increment_platform_wallet', {
        column_name: 'withdrawal_revenue',
        amount: platformFeeCredits,
      }).catch(() => {
        // If RPC doesn't exist, update directly
        serviceClient.from('platform_wallet').update({
          withdrawal_revenue: platformFeeCredits,
        }).eq('id', (serviceClient.from('platform_wallet').select('id').limit(1)));
      });

      // Create or reuse Paystack transfer recipient
      let recipientCode = bankAccount.recipient_code;
      if (!recipientCode) {
        const recipientRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'nuban',
            name: bankAccount.account_name,
            account_number: bankAccount.account_number,
            bank_code: bankAccount.bank_code,
            currency: 'NGN',
          }),
        });
        const recipientData = await recipientRes.json();

        if (!recipientData.status) {
          // Refund on failure
          await serviceClient.rpc('refund_failed_withdrawal', {
            p_user_id: user.id,
            p_amount: credit_amount,
            p_withdrawal_id: null,
          });
          return new Response(JSON.stringify({ error: 'Failed to create transfer recipient', details: recipientData }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        recipientCode = recipientData.data.recipient_code;
        await serviceClient
          .from('user_bank_accounts')
          .update({ recipient_code: recipientCode })
          .eq('id', bank_account_id);
      }

      // Initiate Paystack transfer
      const reference = `wdr_${user.id.slice(0, 8)}_${Date.now()}`;
      const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: amountKobo,
          recipient: recipientCode,
          reason: `Credit withdrawal - ${credit_amount} credits`,
          reference,
          metadata: {
            user_id: user.id,
            credit_amount,
            platform_fee_credits: platformFeeCredits,
            net_credits: netCredits,
          },
        }),
      });
      const transferData = await transferRes.json();

      // Create withdrawal request record
      const withdrawalStatus = transferData.status ? 'processing' : 'failed';
      const { data: withdrawal, error: wdErr } = await serviceClient
        .from('withdrawal_requests')
        .insert({
          user_id: user.id,
          credit_amount,
          platform_fee_credits: platformFeeCredits,
          net_credits: netCredits,
          amount_ngn: amountNgn,
          exchange_rate_used: ngnRate,
          status: withdrawalStatus,
          bank_account_id,
          paystack_transfer_code: transferData.data?.transfer_code || null,
          paystack_reference: reference,
          failure_reason: transferData.status ? null : (transferData.message || 'Transfer initiation failed'),
        })
        .select()
        .single();

      if (!transferData.status) {
        // Refund credits on transfer failure
        await serviceClient.rpc('refund_failed_withdrawal', {
          p_user_id: user.id,
          p_amount: credit_amount,
          p_withdrawal_id: withdrawal?.id || null,
        });
        return new Response(JSON.stringify({ error: 'Transfer failed', details: transferData.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, withdrawal }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
