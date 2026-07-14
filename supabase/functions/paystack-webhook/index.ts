import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import {
  JsonRecord,
  parsePaystackMetadata,
  parseProviderCurrency,
  parseProviderReference,
  parsePurchaseType,
  parseSafeInteger,
  parseUuid,
} from "../paystack-checkout/contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminClient = ReturnType<typeof createClient>;

type PaymentIntent = {
  id: string;
  user_id: string;
  purchase_type: "credits" | "subscription";
  credit_package_id: string | null;
  subscription_tier_id: string | null;
  provider_reference: string | null;
  amount_minor: number;
  currency: string;
  metadata: JsonRecord;
};

type EventResult = {
  status: "processed" | "ignored";
  paymentIntentId?: string | null;
  result?: unknown;
};

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function asRecord(value: unknown): JsonRecord | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function requiredString(value: unknown, fieldName: string): string {
  const parsed = optionalString(value);
  if (!parsed) throw new Error(`${fieldName} is missing`);
  return parsed;
}

function optionalTimestamp(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
      continue;
    }
    return new Date(value).toISOString();
  }
  return null;
}

function optionalProviderPlan(value: unknown): string | null {
  const direct = optionalString(value);
  if (direct) return direct;
  const record = asRecord(value);
  return optionalString(record?.plan_code) ?? optionalString(record?.code);
}

function optionalProviderSubscription(data: JsonRecord): string | null {
  const subscription = asRecord(data.subscription);
  return optionalString(data.subscription_code) ??
    optionalString(subscription?.subscription_code) ??
    optionalString(subscription?.code);
}

function optionalProviderCustomer(data: JsonRecord): string | null {
  const customer = asRecord(data.customer);
  return optionalString(data.customer_code) ??
    optionalString(customer?.customer_code) ??
    optionalString(customer?.code);
}

function checkoutItemId(intent: PaymentIntent): string | null {
  return intent.purchase_type === "credits"
    ? intent.credit_package_id
    : intent.subscription_tier_id;
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{128}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifySignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const signatureBytes = hexToBytes(signature);
  if (!signatureBytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(body),
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function recordEvent(
  admin: AdminClient,
  providerEventId: string,
  eventType: string,
  status: "processed" | "ignored" | "failed",
  payloadHash: string,
  paymentIntentId: string | null,
  errorMessage: string | null = null,
): Promise<void> {
  const { error } = await admin.from("wallet_payment_events").upsert(
    {
      provider: "paystack",
      provider_event_id: providerEventId,
      payment_intent_id: paymentIntentId,
      event_type: eventType,
      status,
      payload_hash: payloadHash,
      error_message: errorMessage?.slice(0, 500) ?? null,
      processed_at: status === "failed" ? null : new Date().toISOString(),
    },
    { onConflict: "provider,provider_event_id" },
  );
  if (error) {
    console.error("paystack-webhook event ledger", { code: error.code });
  }
}

async function processChargeSuccess(
  admin: AdminClient,
  transaction: JsonRecord,
): Promise<EventResult> {
  const reference = parseProviderReference(transaction.reference);
  const metadata = parsePaystackMetadata(transaction.metadata);
  if (!metadata.wallet_payment_intent_id) {
    return { status: "ignored" };
  }

  const intentId = parseUuid(
    metadata.wallet_payment_intent_id,
    "payment intent ID",
  );
  const metadataUserId = parseUuid(metadata.user_id, "metadata user ID");
  const purchaseType = parsePurchaseType(metadata.type);
  const metadataItemId = parseUuid(metadata.item_id, "metadata item ID");
  const metadataAmount = parseSafeInteger(
    metadata.amount_minor,
    "metadata amount",
    { status: 409, code: "PAYMENT_METADATA_INVALID" },
  );
  const metadataCurrency = parseProviderCurrency(metadata.currency);
  const providerAmount = parseSafeInteger(
    transaction.amount,
    "provider amount",
    { status: 409, code: "PAYMENT_AMOUNT_MISMATCH" },
  );
  const providerCurrency = parseProviderCurrency(transaction.currency);

  if (
    metadata.provider !== "paystack" ||
    metadataAmount !== providerAmount ||
    metadataCurrency !== providerCurrency
  ) {
    throw new Error("payment metadata does not match the provider transaction");
  }

  const { data: intentData, error: intentError } = await admin
    .from("wallet_payment_intents")
    .select(
      "id,user_id,purchase_type,credit_package_id,subscription_tier_id," +
        "provider_reference,amount_minor,currency,metadata",
    )
    .eq("id", intentId)
    .eq("provider", "paystack")
    .single();

  if (intentError || !intentData) throw new Error("payment intent not found");
  const intent = intentData as PaymentIntent;
  if (
    intent.user_id !== metadataUserId ||
    intent.provider_reference !== reference ||
    intent.purchase_type !== purchaseType ||
    checkoutItemId(intent) !== metadataItemId ||
    Number(intent.amount_minor) !== providerAmount ||
    intent.currency !== providerCurrency
  ) {
    throw new Error("payment intent does not match the provider transaction");
  }

  const intentPlanCode = optionalString(intent.metadata?.paystack_plan_code);
  const metadataPlanCode = optionalString(metadata.plan_code);
  if (intentPlanCode !== metadataPlanCode) {
    throw new Error("payment plan metadata mismatch");
  }
  if (
    purchaseType === "subscription" &&
    (!intentPlanCode ||
      optionalProviderPlan(transaction.plan) !== intentPlanCode)
  ) {
    throw new Error("subscription plan metadata mismatch");
  }

  const { data: completed, error: completeError } = await admin.rpc(
    "wallet_complete_payment",
    {
      p_intent_id: intent.id,
      p_provider: "paystack",
      p_provider_reference: reference,
      p_provider_payment_reference: reference,
      p_provider_subscription_id: optionalProviderSubscription(transaction),
      p_provider_customer_id: optionalProviderCustomer(transaction),
      p_amount_minor: providerAmount,
      p_currency: providerCurrency,
      p_period_start: optionalTimestamp(transaction.paid_at),
      p_period_end: optionalTimestamp(transaction.next_payment_date),
    },
  );
  if (completeError) throw completeError;

  return {
    status: "processed",
    paymentIntentId: intent.id,
    result: completed,
  };
}

async function processSubscriptionCreated(
  admin: AdminClient,
  data: JsonRecord,
): Promise<EventResult> {
  const subscriptionCode = requiredString(
    optionalProviderSubscription(data),
    "subscription code",
  );
  const customerCode = requiredString(
    optionalProviderCustomer(data),
    "customer code",
  );
  const planCode = requiredString(
    optionalProviderPlan(data.plan),
    "plan code",
  );

  const { data: tier, error: tierError } = await admin
    .from("subscription_tiers")
    .select("id")
    .eq("paystack_plan_code", planCode)
    .eq("is_active", true)
    .single();
  if (tierError || !tier) throw new Error("subscription tier not found");

  const { data: subscription, error: subscriptionError } = await admin
    .from("user_subscriptions")
    .select("id,user_id")
    .eq("provider", "paystack")
    .eq("provider_customer_id", customerCode)
    .eq("tier_id", tier.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subscriptionError || !subscription) {
    throw new Error("subscription checkout has not been completed yet");
  }

  const periodStart = optionalTimestamp(
    data.created_at,
    data.createdAt,
    data.start,
  );
  const periodEnd = optionalTimestamp(
    data.next_payment_date,
    data.current_period_end,
  );
  const { error: updateError } = await admin
    .from("user_subscriptions")
    .update({
      provider_subscription_id: subscriptionCode,
      status: "active",
      current_period_start: periodStart ?? undefined,
      current_period_end: periodEnd ?? undefined,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);
  if (updateError) throw updateError;

  const { error: intentUpdateError } = await admin
    .from("wallet_payment_intents")
    .update({
      provider_subscription_id: subscriptionCode,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", subscription.user_id)
    .eq("subscription_tier_id", tier.id)
    .eq("provider", "paystack")
    .eq("status", "completed")
    .is("provider_subscription_id", null);
  if (intentUpdateError) throw intentUpdateError;

  return { status: "processed" };
}

async function processSubscriptionStatus(
  admin: AdminClient,
  eventType: string,
  data: JsonRecord,
): Promise<EventResult> {
  const subscriptionCode = requiredString(
    optionalProviderSubscription(data),
    "subscription code",
  );
  const update = eventType === "subscription.not_renew"
    ? {
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    }
    : {
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };
  const { error } = await admin
    .from("user_subscriptions")
    .update(update)
    .eq("provider", "paystack")
    .eq("provider_subscription_id", subscriptionCode);
  if (error) throw error;
  return { status: "processed" };
}

async function processInvoiceUpdate(
  admin: AdminClient,
  data: JsonRecord,
): Promise<EventResult> {
  const transaction = asRecord(data.transaction);
  const paid = data.paid === true ||
    optionalString(data.status)?.toLowerCase() === "success";
  if (!paid || !transaction) return { status: "ignored" };

  const subscriptionCode = requiredString(
    optionalProviderSubscription(data),
    "subscription code",
  );
  const reference = parseProviderReference(transaction.reference);
  const amount = parseSafeInteger(
    transaction.amount,
    "subscription renewal amount",
    { status: 409, code: "PAYMENT_AMOUNT_MISMATCH" },
  );
  const currency = parseProviderCurrency(transaction.currency);
  const { data: completed, error } = await admin.rpc(
    "wallet_complete_subscription_renewal",
    {
      p_provider: "paystack",
      p_provider_subscription_id: subscriptionCode,
      p_provider_payment_reference: reference,
      p_amount_minor: amount,
      p_currency: currency,
      p_period_start: optionalTimestamp(
        data.period_start,
        data.current_period_start,
      ),
      p_period_end: optionalTimestamp(
        data.period_end,
        data.current_period_end,
        data.next_payment_date,
      ),
    },
  );
  if (error) throw error;
  return { status: "processed", result: completed };
}

async function processTransferEvent(
  admin: AdminClient,
  eventType: string,
  data: JsonRecord,
): Promise<EventResult> {
  const reference = parseProviderReference(data.reference);
  const { data: creatorPayout, error: payoutLookupError } = await admin
    .from("creator_payout_requests")
    .select("id,status")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (payoutLookupError) throw payoutLookupError;

  if (creatorPayout) {
    const status = eventType === "transfer.success"
      ? "paid"
      : eventType === "transfer.reversed"
      ? "reversed"
      : "failed";
    const { error } = await admin.rpc("wallet_update_creator_payout_status", {
      p_request_id: creatorPayout.id,
      p_status: status,
      p_provider_reference: reference,
      p_failure_reason: status === "failed"
        ? optionalString(data.reason) ?? eventType
        : null,
    });
    if (error) throw error;
    return { status: "processed" };
  }

  const { data: withdrawal, error: withdrawalError } = await admin
    .from("withdrawal_requests")
    .select("id,user_id,credit_amount,status")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (withdrawalError) throw withdrawalError;
  if (!withdrawal) return { status: "ignored" };
  if (withdrawal.status === "failed") {
    return { status: "processed" };
  }
  if (
    withdrawal.status === "completed" &&
    eventType !== "transfer.reversed"
  ) {
    return { status: "processed" };
  }

  if (eventType === "transfer.success") {
    const { error } = await admin
      .from("withdrawal_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal.id);
    if (error) throw error;
    return { status: "processed" };
  }

  const { error: updateError } = await admin
    .from("withdrawal_requests")
    .update({
      status: "failed",
      failure_reason: optionalString(data.reason) ?? eventType,
      processed_at: new Date().toISOString(),
    })
    .eq("id", withdrawal.id);
  if (updateError) throw updateError;

  const { error: refundError } = await admin.rpc("refund_failed_withdrawal", {
    p_user_id: withdrawal.user_id,
    p_amount: withdrawal.credit_amount,
    p_withdrawal_id: withdrawal.id,
  });
  if (refundError) throw refundError;
  return { status: "processed" };
}

function eventLedgerId(
  eventType: string,
  data: JsonRecord,
  payloadHash: string,
): string {
  const transaction = asRecord(data.transaction);
  let identifier: string | null = null;
  switch (eventType) {
    case "charge.success":
    case "transfer.success":
    case "transfer.failed":
    case "transfer.reversed":
      identifier = optionalString(data.reference);
      break;
    case "subscription.create":
    case "subscription.disable":
    case "subscription.not_renew":
      identifier = optionalProviderSubscription(data);
      break;
    case "invoice.update":
      identifier = [
        optionalString(data.invoice_code),
        optionalString(data.status) ?? (data.paid === true ? "paid" : "unpaid"),
        optionalString(transaction?.reference),
      ].filter((part): part is string => part != null).join(":") || null;
      break;
  }
  return identifier
    ? `${eventType}:${identifier}`
    : `${eventType}:${payloadHash.slice(0, 40)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let admin: AdminClient | null = null;
  let providerEventId: string | null = null;
  let eventType = "unknown";
  let payloadHash = "";
  let paymentIntentId: string | null = null;

  try {
    const paystackSecretKey = requiredEnv("PAYSTACK_SECRET_KEY");
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    if (!await verifySignature(body, signature, paystackSecretKey)) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const event = asRecord(JSON.parse(body));
    const data = asRecord(event?.data);
    eventType = requiredString(event?.event, "event type");
    if (!event || !data) throw new Error("webhook payload is invalid");

    payloadHash = await sha256(body);
    providerEventId = eventLedgerId(eventType, data, payloadHash);
    admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: existing } = await admin
      .from("wallet_payment_events")
      .select("status")
      .eq("provider", "paystack")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    if (existing?.status === "processed" || existing?.status === "ignored") {
      return jsonResponse({ received: true, already_processed: true });
    }

    let result: EventResult;
    switch (eventType) {
      case "charge.success":
        result = await processChargeSuccess(admin, data);
        break;
      case "subscription.create":
        result = await processSubscriptionCreated(admin, data);
        break;
      case "subscription.not_renew":
      case "subscription.disable":
        result = await processSubscriptionStatus(admin, eventType, data);
        break;
      case "invoice.update":
        result = await processInvoiceUpdate(admin, data);
        break;
      case "transfer.success":
      case "transfer.failed":
      case "transfer.reversed":
        result = await processTransferEvent(admin, eventType, data);
        break;
      default:
        result = { status: "ignored" };
    }

    paymentIntentId = result.paymentIntentId ?? null;
    await recordEvent(
      admin,
      providerEventId,
      eventType,
      result.status,
      payloadHash,
      paymentIntentId,
    );
    return jsonResponse({
      received: true,
      processed: result.status === "processed",
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Webhook processing failed";
    console.error("paystack-webhook", { eventType, message });
    if (admin && providerEventId) {
      await recordEvent(
        admin,
        providerEventId,
        eventType,
        "failed",
        payloadHash,
        paymentIntentId,
        message,
      );
    }
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});
