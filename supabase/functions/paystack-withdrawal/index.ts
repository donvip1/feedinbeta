import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PAYSTACK_BASE = 'https://api.paystack.co';
const CREDITS_PER_USD = 100;
const PLATFORM_FEE_PERCENT = 30;
const MIN_WITHDRAWAL_CREDITS = 1000;
const COOLDOWN_MINUTES = 5; // Rate limit: one withdrawal per 5 minutes
const DIRECT_PAYOUTS_ENABLED = false;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
  if (
    typeof parsed !== 'number' ||
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed;
}

function requiredNgnRate(): number {
  const rate = Number(Deno.env.get('PAYSTACK_NGN_PER_USD'));
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('PAYSTACK_NGN_PER_USD not configured');
  }
  return rate;
}

async function readProviderResponse(response: Response): Promise<JsonRecord> {
  const data = asRecord(await response.json());
  if (!data) throw new Error('Payment provider returned an invalid response');
  return data;
}

function getFriendlyErrorMessage(technicalError: string): string {
  const lower = technicalError.toLowerCase();
  if (lower.includes('insufficient') || lower.includes('not enough'))
    return 'You don\'t have enough credits for this withdrawal. Please check your balance.';
  if (lower.includes('check constraint') || lower.includes('violates'))
    return 'We couldn\'t process your withdrawal right now. Please try again shortly.';
  if (lower.includes('paystack') || lower.includes('transfer'))
    return 'Our payment provider is temporarily unavailable. Please try again in a few minutes.';
  if (lower.includes('timeout') || lower.includes('timed out'))
    return 'The request took too long. Please try again.';
  if (lower.includes('network') || lower.includes('fetch'))
    return 'Connection issue. Please check your internet and try again.';
  if (lower.includes('not configured'))
    return 'Payment system is being set up. Please try again later.';
  return 'Something went wrong with your withdrawal. Please try again or contact support.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!DIRECT_PAYOUTS_ENABLED) {
    return new Response(JSON.stringify({
      error:
        'Direct withdrawals are temporarily unavailable. Sell credits through P2P or request a Feedin finance buyback.',
      code: 'PAYOUTS_DISABLED',
    }), {
      status: 409,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) throw new Error('PAYSTACK_SECRET_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase service credentials not configured');
    }

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

    // Creator payouts use verified Paystack transfer recipients. Only the
    // masked destination is client-readable; the recipient code stays in the
    // service-role-only destination secrets table.
    if (action === 'save-creator-payout-destination') {
      const bankCode = optionalString(params.bank_code);
      const bankName = optionalString(params.bank_name);
      const accountNumber = optionalString(params.account_number);
      if (
        !bankCode ||
        !bankName ||
        !accountNumber ||
        !/^\d{10}$/.test(accountNumber)
      ) {
        return new Response(JSON.stringify({
          error: 'Select a bank and enter a valid 10-digit account number',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const resolveResponse = await fetch(
        `${PAYSTACK_BASE}/bank/resolve?account_number=${
          encodeURIComponent(accountNumber)
        }&bank_code=${encodeURIComponent(bankCode)}`,
        { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
      );
      const resolved = await readProviderResponse(resolveResponse);
      const resolvedData = asRecord(resolved.data);
      const accountName = optionalString(resolvedData?.account_name);
      if (!resolveResponse.ok || resolved.status !== true || !accountName) {
        return new Response(JSON.stringify({
          error: optionalString(resolved.message) ??
            'Could not verify this bank account',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recipientResponse = await fetch(
        `${PAYSTACK_BASE}/transferrecipient`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'nuban',
            name: accountName,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN',
          }),
        },
      );
      const recipient = await readProviderResponse(recipientResponse);
      const recipientData = asRecord(recipient.data);
      const recipientCode = optionalString(recipientData?.recipient_code);
      if (
        !recipientResponse.ok ||
        recipient.status !== true ||
        !recipientCode
      ) {
        return new Response(JSON.stringify({
          error: optionalString(recipient.message) ??
            'Could not create the payout destination',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accountLast4 = accountNumber.slice(-4);
      const { data: destination, error: destinationError } =
        await serviceClient.rpc('wallet_save_creator_payout_destination', {
          p_user_id: user.id,
          p_display_label: `${bankName} - ****${accountLast4}`,
          p_account_last4: accountLast4,
          p_currency: 'NGN',
          p_country_code: 'NG',
          p_provider_reference: recipientCode,
          p_metadata: {
            bank_code: bankCode,
            bank_name: bankName,
            account_name: accountName,
          },
        });
      if (destinationError || !destination) {
        throw destinationError ??
          new Error('Could not save the payout destination');
      }

      return new Response(JSON.stringify({
        success: true,
        destination,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'process-creator-payout') {
      const requestId = optionalString(params.request_id);
      if (
        !requestId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(requestId)
      ) {
        return new Response(JSON.stringify({ error: 'Invalid payout request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: payout, error: payoutError } = await serviceClient
        .from('creator_payout_requests')
        .select(
          'id,user_id,amount_minor,currency,status,provider,' +
            'payout_destination_id,provider_reference',
        )
        .eq('id', requestId)
        .eq('user_id', user.id)
        .single();
      if (payoutError || !payout) {
        return new Response(JSON.stringify({
          error: 'Payout request not found',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (payout.status === 'paid' || payout.status === 'processing') {
        return new Response(JSON.stringify({ success: true, payout }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (
        payout.status !== 'pending' ||
        payout.provider !== 'paystack' ||
        payout.currency !== 'USD'
      ) {
        return new Response(JSON.stringify({
          error: `Payout cannot be processed from status ${payout.status}`,
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const amountMinor = parsePositiveInteger(
        payout.amount_minor,
        'payout amount',
      );
      const amountKobo = Math.round(amountMinor * requiredNgnRate());
      if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        throw new Error('Converted payout amount is invalid');
      }

      const reference = `cp_${requestId.replaceAll('-', '')}`;
      const { data: claimed, error: claimError } = await serviceClient.rpc(
        'wallet_claim_creator_payout',
        {
          p_request_id: requestId,
          p_user_id: user.id,
          p_provider_reference: reference,
        },
      );
      if (claimError || !claimed) {
        throw claimError ?? new Error('Could not claim payout request');
      }

      const { data: destinationSecret, error: secretError } =
        await serviceClient
          .from('creator_payout_destination_secrets')
          .select('provider_reference')
          .eq('destination_id', payout.payout_destination_id)
          .single();
      const recipientCode = optionalString(
        destinationSecret?.provider_reference,
      );
      if (secretError || !recipientCode) {
        await serviceClient.rpc('wallet_update_creator_payout_status', {
          p_request_id: requestId,
          p_status: 'failed',
          p_provider_reference: reference,
          p_failure_reason: 'Payout destination is unavailable',
        });
        throw new Error('Payout destination is unavailable');
      }

      const transferResponse = await fetch(`${PAYSTACK_BASE}/transfer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: amountKobo,
          recipient: recipientCode,
          reason: `Feedin creator payout ${requestId}`,
          reference,
          metadata: {
            creator_payout_request_id: requestId,
            user_id: user.id,
            amount_minor: String(amountMinor),
            source_currency: 'USD',
          },
        }),
      });
      const transfer = await readProviderResponse(transferResponse);
      if (!transferResponse.ok || transfer.status !== true) {
        const failureReason = optionalString(transfer.message) ??
          'Paystack transfer initiation failed';
        await serviceClient.rpc('wallet_update_creator_payout_status', {
          p_request_id: requestId,
          p_status: 'failed',
          p_provider_reference: reference,
          p_failure_reason: failureReason,
        });
        return new Response(JSON.stringify({ error: failureReason }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        payout: claimed,
        transfer_status: optionalString(asRecord(transfer.data)?.status) ??
          'processing',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

      // Validate input format
      if (!/^\d{10}$/.test(account_number)) {
        return new Response(JSON.stringify({ error: 'Account number must be exactly 10 digits' }), {
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

      // Check for duplicate account
      const { data: existing } = await serviceClient
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('account_number', account_number)
        .eq('bank_code', bank_code)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'This bank account is already saved' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Limit to 5 bank accounts per user
      const { count } = await serviceClient
        .from('user_bank_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((count ?? 0) >= 5) {
        return new Response(JSON.stringify({ error: 'Maximum 5 bank accounts allowed' }), {
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

      // Validate credit_amount is a positive integer
      if (!credit_amount || !Number.isInteger(credit_amount) || credit_amount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid credit amount' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (credit_amount < MIN_WITHDRAWAL_CREDITS) {
        return new Response(JSON.stringify({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL_CREDITS} credits (~$9.99)` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!bank_account_id) {
        return new Response(JSON.stringify({ error: 'Please select a bank account' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit: check for recent pending/processing withdrawals
      const cooldownTime = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
      const { data: recentWithdrawals } = await serviceClient
        .from('withdrawal_requests')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .gte('requested_at', cooldownTime);

      if (recentWithdrawals && recentWithdrawals.length > 0) {
        return new Response(JSON.stringify({ error: `Please wait ${COOLDOWN_MINUTES} minutes between withdrawal requests` }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get bank account (verify ownership)
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

      if (amountKobo < 100) {
        return new Response(JSON.stringify({ error: 'Amount too small to transfer' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Deduct credits atomically (checks balance inside)
      const { error: deductErr } = await serviceClient.rpc('deduct_credits_for_withdrawal', {
        p_user_id: user.id,
        p_amount: credit_amount,
      });

      if (deductErr) {
        console.error('Deduction error:', deductErr);
        return new Response(JSON.stringify({ error: deductErr.message || 'Insufficient credits' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Record platform fee revenue atomically
      try {
        await serviceClient.rpc('increment_platform_wallet', {
          column_name: 'withdrawal_revenue',
          amount: platformFeeCredits,
        });
      } catch (e) {
        console.error('Platform wallet update error (non-blocking):', e);
      }

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
          // Refund on recipient creation failure
          await serviceClient.rpc('refund_failed_withdrawal', {
            p_user_id: user.id,
            p_amount: credit_amount,
            p_withdrawal_id: null,
          });
          console.error('Recipient creation failed:', recipientData);
          return new Response(JSON.stringify({ error: 'Failed to create transfer recipient. Credits refunded.' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        recipientCode = recipientData.data.recipient_code;
        await serviceClient
          .from('user_bank_accounts')
          .update({ recipient_code: recipientCode })
          .eq('id', bank_account_id);
      }

      // Generate unique reference
      const reference = `wdr_${user.id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Initiate Paystack transfer
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
      console.log('Transfer response:', JSON.stringify(transferData));

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

      if (wdErr) {
        console.error('Withdrawal record error:', wdErr);
      }

      if (!transferData.status) {
        // Refund credits on transfer initiation failure
        await serviceClient.rpc('refund_failed_withdrawal', {
          p_user_id: user.id,
          p_amount: credit_amount,
          p_withdrawal_id: withdrawal?.id || null,
        });

        // Translate Paystack errors to friendly messages
        const paystackMsg = (transferData.message || '').toLowerCase();
        let friendlyError = 'We couldn\'t process your withdrawal right now. Your credits have been refunded.';
        if (paystackMsg.includes('starter business') || paystackMsg.includes('third party payout')) {
          friendlyError = 'Withdrawals are temporarily unavailable while we complete payment provider verification. Your credits have been refunded. Please try again later.';
        } else if (paystackMsg.includes('insufficient') || paystackMsg.includes('balance')) {
          friendlyError = 'Our payment system has insufficient funds to process this withdrawal right now. Your credits have been refunded. Please try again later.';
        } else if (paystackMsg.includes('recipient')) {
          friendlyError = 'There was an issue with your bank account details. Your credits have been refunded. Please verify your bank info and try again.';
        }

        console.error('Transfer failed:', transferData.message);
        return new Response(JSON.stringify({ error: friendlyError }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, withdrawal }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── GET WITHDRAWAL STATUS ───
    if (action === 'get-withdrawals') {
      const { data: withdrawals, error } = await serviceClient
        .from('withdrawal_requests')
        .select('*, user_bank_accounts(bank_name, account_number)')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return new Response(JSON.stringify({ withdrawals }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    // Return user-friendly error messages instead of raw technical errors
    const friendlyMessage = getFriendlyErrorMessage(error.message || 'Unknown error');
    return new Response(JSON.stringify({ error: friendlyMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
