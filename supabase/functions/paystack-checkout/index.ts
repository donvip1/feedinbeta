import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import {
  BillingInterval,
  checkoutExpiry,
  createPaystackReference,
  JsonRecord,
  normalizeCurrency,
  parseBillingInterval,
  parsePaystackMetadata,
  parseProviderCurrency,
  parseProviderReference,
  parsePurchaseType,
  parseSafeInteger,
  parseUuid,
  PurchaseType,
  RequestError,
  requireHttpsUrl,
  requirePaystackCheckoutUrl,
  resolveIdempotencyKey,
  safeProviderMessage,
  toPaystackAmountMinor,
  toPaystackPlanInterval,
} from "./contracts.ts";

const PAYSTACK_API = "https://api.paystack.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PaymentIntent = {
  id: string;
  user_id: string;
  purchase_type: PurchaseType;
  credit_package_id: string | null;
  subscription_tier_id: string | null;
  provider: "paystack";
  idempotency_key: string;
  status: string;
  amount_minor: number;
  currency: string;
  checkout_url: string | null;
  provider_reference: string | null;
  initialization_token: string | null;
  metadata: JsonRecord;
};

type AdminClient = ReturnType<typeof createClient>;

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
  if (!value) {
    throw new RequestError(
      `${name} is not configured`,
      500,
      "CONFIG_ERROR",
    );
  }
  return value;
}

function requiredPaystackNgnRate(): number {
  const value = Number(Deno.env.get("PAYSTACK_NGN_PER_USD"));
  if (!Number.isFinite(value) || value <= 0) {
    throw new RequestError(
      "NGN exchange rate is not configured",
      503,
      "EXCHANGE_RATE_UNAVAILABLE",
    );
  }
  return value;
}

function createAdminClient(supabaseUrl: string): AdminClient {
  return createClient(supabaseUrl, requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

function optionalProviderPlan(value: unknown): string | null {
  const direct = optionalString(value);
  if (direct) return direct;
  const record = asRecord(value);
  return optionalString(record?.plan_code) ?? optionalString(record?.code);
}

function optionalProviderSubscription(transaction: JsonRecord): string | null {
  const subscription = asRecord(transaction.subscription);
  return optionalString(transaction.subscription_code) ??
    optionalString(subscription?.subscription_code) ??
    optionalString(subscription?.code);
}

function optionalTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return new Date(value).toISOString();
}

async function readJson(req: Request): Promise<JsonRecord> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestError("Content-Type must be application/json", 415);
  }
  try {
    const body = await req.json();
    const record = asRecord(body);
    if (!record) throw new Error("Body must be an object");
    return record;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Invalid JSON body");
  }
}

async function readPaystackResponse(response: Response): Promise<JsonRecord> {
  try {
    const payload = asRecord(await response.json());
    if (!payload) throw new Error("Response was not an object");
    return payload;
  } catch {
    throw new RequestError(
      "Payment provider returned an invalid response",
      502,
      "PROVIDER_RESPONSE_INVALID",
    );
  }
}

async function paystackFetch(
  path: string,
  secretKey: string,
  init: RequestInit = {},
): Promise<{ response: Response; payload: JsonRecord }> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${secretKey}`);
    headers.set("Accept", "application/json");
    response = await fetch(`${PAYSTACK_API}${path}`, { ...init, headers });
  } catch {
    throw new RequestError(
      "Payment provider is temporarily unavailable",
      502,
      "PROVIDER_UNAVAILABLE",
    );
  }
  return { response, payload: await readPaystackResponse(response) };
}

async function validatePaystackPlan(
  secretKey: string,
  planCode: string,
  amountMinor: number,
  currency: string,
  billingInterval: BillingInterval,
): Promise<void> {
  const { response, payload } = await paystackFetch(
    `/plan/${encodeURIComponent(planCode)}`,
    secretKey,
  );
  const plan = asRecord(payload.data);
  if (!response.ok || payload.status !== true || !plan) {
    throw new RequestError(
      safeProviderMessage(payload.message),
      409,
      "PAYSTACK_PLAN_UNAVAILABLE",
    );
  }

  const providerAmount = parseSafeInteger(plan.amount, "Paystack plan amount", {
    status: 502,
    code: "PROVIDER_RESPONSE_INVALID",
  });
  const providerCurrency = normalizeCurrency(plan.currency);
  const providerInterval = optionalString(plan.interval);
  if (
    optionalString(plan.plan_code) !== planCode ||
    providerAmount !== amountMinor ||
    providerCurrency !== currency ||
    providerInterval !== toPaystackPlanInterval(billingInterval)
  ) {
    throw new RequestError(
      "The configured Paystack plan does not match the native catalog price",
      409,
      "PAYSTACK_PLAN_MISMATCH",
    );
  }
}

async function createPaystackPlan(
  secretKey: string,
  name: string,
  amountMinor: number,
  currency: string,
  billingInterval: BillingInterval,
): Promise<string> {
  const { response, payload } = await paystackFetch(
    "/plan",
    secretKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        amount: amountMinor,
        currency,
        interval: toPaystackPlanInterval(billingInterval),
      }),
    },
  );
  const plan = asRecord(payload.data);
  const planCode = optionalString(plan?.plan_code);
  if (!response.ok || payload.status !== true || !planCode) {
    throw new RequestError(
      safeProviderMessage(payload.message),
      502,
      "PAYSTACK_PLAN_CREATION_FAILED",
    );
  }
  return planCode;
}

function checkoutItemId(intent: PaymentIntent): string | null {
  return intent.purchase_type === "credits"
    ? intent.credit_package_id
    : intent.subscription_tier_id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
    );
  }

  let admin: AdminClient | null = null;
  let currentIntentId: string | null = null;
  let initializationToken: string | null = null;

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      throw new RequestError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new RequestError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await readJson(req);
    const paystackSecretKey = requiredEnv("PAYSTACK_SECRET_KEY");

    if (body.action === "verify") {
      const reference = parseProviderReference(body.reference);
      const { response, payload } = await paystackFetch(
        `/transaction/verify/${encodeURIComponent(reference)}`,
        paystackSecretKey,
      );
      const transaction = asRecord(payload.data);
      if (
        !response.ok ||
        payload.status !== true ||
        transaction?.status !== "success"
      ) {
        throw new RequestError(
          "Payment has not been completed",
          409,
          "PAYMENT_NOT_COMPLETE",
        );
      }
      if (transaction.reference !== reference) {
        throw new RequestError(
          "Payment reference mismatch",
          409,
          "PAYMENT_REFERENCE_MISMATCH",
        );
      }

      const metadata = parsePaystackMetadata(transaction.metadata);
      if (metadata.user_id !== user.id) {
        throw new RequestError(
          "Payment does not belong to the authenticated user",
          403,
          "PAYMENT_OWNER_MISMATCH",
        );
      }
      if (metadata.provider !== "paystack") {
        throw new RequestError(
          "Payment provider metadata mismatch",
          409,
          "PAYMENT_METADATA_INVALID",
        );
      }

      const intentId = parseUuid(
        metadata.wallet_payment_intent_id,
        "payment intent ID",
      );
      const metadataPurchaseType = parsePurchaseType(metadata.type);
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
        metadataAmount !== providerAmount ||
        metadataCurrency !== providerCurrency
      ) {
        throw new RequestError(
          "Payment amount or currency metadata mismatch",
          409,
          "PAYMENT_METADATA_INVALID",
        );
      }

      // Service-role access starts only after caller auth and provider metadata
      // ownership, type, item, amount, and currency have all been verified.
      admin = createAdminClient(supabaseUrl);
      const { data: intentData, error: intentError } = await admin
        .from("wallet_payment_intents")
        .select(
          "id,user_id,purchase_type,credit_package_id,subscription_tier_id," +
            "provider,idempotency_key,status,amount_minor,currency,checkout_url," +
            "provider_reference,initialization_token,metadata",
        )
        .eq("id", intentId)
        .eq("user_id", user.id)
        .eq("provider", "paystack")
        .single();

      if (intentError || !intentData) {
        throw new RequestError(
          "Payment intent not found",
          404,
          "PAYMENT_INTENT_NOT_FOUND",
        );
      }
      const intent = intentData as PaymentIntent;
      if (
        intent.provider_reference !== reference ||
        intent.purchase_type !== metadataPurchaseType ||
        checkoutItemId(intent) !== metadataItemId
      ) {
        throw new RequestError(
          "Payment intent metadata mismatch",
          409,
          "PAYMENT_METADATA_INVALID",
        );
      }
      if (
        Number(intent.amount_minor) !== providerAmount ||
        intent.currency !== providerCurrency
      ) {
        throw new RequestError(
          "Payment amount or currency mismatch",
          409,
          "PAYMENT_AMOUNT_MISMATCH",
        );
      }

      const intentPlanCode = optionalString(intent.metadata?.paystack_plan_code);
      const metadataPlanCode = optionalString(metadata.plan_code);
      if (intentPlanCode !== metadataPlanCode) {
        throw new RequestError(
          "Payment plan metadata mismatch",
          409,
          "PAYMENT_METADATA_INVALID",
        );
      }

      if (metadataPurchaseType === "subscription") {
        const providerPlan = optionalProviderPlan(transaction.plan);
        if (!intentPlanCode || providerPlan !== intentPlanCode) {
          throw new RequestError(
            "Subscription provider metadata is incomplete",
            409,
            "PAYMENT_METADATA_INVALID",
          );
        }
      }

      const customer = asRecord(transaction.customer);
      const { data: completed, error: completeError } = await admin.rpc(
        "wallet_complete_payment",
        {
          p_intent_id: intent.id,
          p_provider: "paystack",
          p_provider_reference: reference,
          p_provider_payment_reference: reference,
          p_provider_subscription_id: optionalProviderSubscription(transaction),
          p_provider_customer_id: optionalString(customer?.customer_code),
          p_amount_minor: providerAmount,
          p_currency: providerCurrency,
          p_period_start: optionalTimestamp(transaction.paid_at),
          p_period_end: optionalTimestamp(transaction.next_payment_date),
        },
      );
      if (completeError) throw completeError;

      const { error: eventError } = await admin
        .from("wallet_payment_events")
        .upsert(
          {
            provider: "paystack",
            provider_event_id: `verify:${reference}`,
            payment_intent_id: intent.id,
            event_type: "charge.verify",
            status: "processed",
            processed_at: new Date().toISOString(),
          },
          { onConflict: "provider,provider_event_id" },
        );
      if (eventError) {
        console.error("paystack-checkout event ledger", {
          code: eventError.code,
        });
      }

      return jsonResponse({ success: true, payment: completed });
    }

    if (body.action != null && body.action !== "initialize") {
      throw new RequestError("Invalid checkout action");
    }

    const purchaseType = parsePurchaseType(body.type);
    const itemId = parseUuid(body.itemId, "item ID");
    const requestedIdempotencyKey = resolveIdempotencyKey(
      body.idempotencyKey,
      req.headers.get("Idempotency-Key"),
    );

    admin = createAdminClient(supabaseUrl);

    let priceMinor: number;
    let catalogCurrency: string;
    let creditsAmount: number;
    let billingInterval: BillingInterval | null = null;
    let paystackPlanCode: string | null = null;
    let description: string;

    if (purchaseType === "credits") {
      const { data: creditPackage, error } = await admin
        .from("credit_packages")
        .select("id,name,credits,bonus_credits,price_cents,currency")
        .eq("id", itemId)
        .eq("is_active", true)
        .single();
      if (error || !creditPackage) {
        throw new RequestError(
          "Credit package not found",
          404,
          "CATALOG_ITEM_NOT_FOUND",
        );
      }

      priceMinor = parseSafeInteger(
        creditPackage.price_cents,
        "catalog price",
        { status: 500, code: "CATALOG_ERROR" },
      );
      catalogCurrency = normalizeCurrency(creditPackage.currency);
      const baseCredits = parseSafeInteger(
        creditPackage.credits,
        "catalog credits",
        { status: 500, code: "CATALOG_ERROR" },
      );
      const bonusCredits = parseSafeInteger(
        creditPackage.bonus_credits ?? 0,
        "catalog bonus credits",
        { allowZero: true, status: 500, code: "CATALOG_ERROR" },
      );
      creditsAmount = parseSafeInteger(
        baseCredits + bonusCredits,
        "catalog total credits",
        { status: 500, code: "CATALOG_ERROR" },
      );
      description = `${creditPackage.name} - ${creditsAmount} credits`;
    } else {
      const { data: tier, error } = await admin
        .from("subscription_tiers")
        .select(
          "id,name,price_cents,currency,billing_interval," +
            "subscription_credits,paystack_plan_code",
        )
        .eq("id", itemId)
        .eq("is_active", true)
        .single();
      if (error || !tier) {
        throw new RequestError(
          "Subscription tier not found",
          404,
          "CATALOG_ITEM_NOT_FOUND",
        );
      }

      priceMinor = parseSafeInteger(tier.price_cents, "catalog price", {
        status: 500,
        code: "CATALOG_ERROR",
      });
      catalogCurrency = normalizeCurrency(tier.currency);
      creditsAmount = parseSafeInteger(
        tier.subscription_credits ?? 0,
        "subscription credits",
        { allowZero: true, status: 500, code: "CATALOG_ERROR" },
      );
      billingInterval = parseBillingInterval(tier.billing_interval);
      paystackPlanCode = optionalString(tier.paystack_plan_code);
      description = `${tier.name} subscription`;
    }

    let ngnRate: number | null = null;
    if (catalogCurrency !== "NGN") {
      ngnRate = requiredPaystackNgnRate();
    }
    const amountMinor = toPaystackAmountMinor(
      priceMinor,
      catalogCurrency,
      ngnRate,
    );

    if (purchaseType === "subscription" && billingInterval) {
      if (!paystackPlanCode) {
        const createdPlanCode = await createPaystackPlan(
          paystackSecretKey,
          description,
          amountMinor,
          "NGN",
          billingInterval,
        );
        const { data: configuredPlanCode, error: configurePlanError } =
          await admin.rpc("wallet_configure_paystack_plan", {
            p_tier_id: itemId,
            p_plan_code: createdPlanCode,
          });
        if (configurePlanError) throw configurePlanError;
        paystackPlanCode = optionalString(configuredPlanCode);
        if (!paystackPlanCode) {
          throw new RequestError(
            "Subscription Paystack plan could not be configured",
            500,
            "CATALOG_ERROR",
          );
        }
        if (paystackPlanCode !== createdPlanCode) {
          await validatePaystackPlan(
            paystackSecretKey,
            paystackPlanCode,
            amountMinor,
            "NGN",
            billingInterval,
          );
        }
      } else {
        await validatePaystackPlan(
          paystackSecretKey,
          paystackPlanCode,
          amountMinor,
          "NGN",
          billingInterval,
        );
      }
    }

    const { data: registered, error: registerError } = await admin.rpc(
      "wallet_register_payment_intent",
      {
        p_user_id: user.id,
        p_purchase_type: purchaseType,
        p_item_id: itemId,
        p_provider: "paystack",
        p_idempotency_key: requestedIdempotencyKey,
        p_amount_minor: amountMinor,
        p_currency: "NGN",
        p_credits_amount: creditsAmount,
        p_billing_interval: billingInterval,
        p_metadata: {
          description,
          catalog_amount_minor: priceMinor,
          catalog_currency: catalogCurrency,
          paystack_plan_code: paystackPlanCode,
        },
      },
    );
    if (registerError || !registered) {
      throw registerError ?? new Error("Could not create payment intent");
    }

    let intent = registered as PaymentIntent;
    if (intent.status === "initialized" && intent.checkout_url) {
      return jsonResponse({
        authorization_url: intent.checkout_url,
        reference: intent.provider_reference,
        payment_intent_id: intent.id,
        idempotency_key: intent.idempotency_key,
        reused: true,
      });
    }
    if (intent.status === "initializing") {
      throw new RequestError(
        "Checkout initialization is already in progress",
        409,
        "CHECKOUT_INITIALIZING",
      );
    }
    if (intent.status !== "creating") {
      throw new RequestError(
        `Checkout cannot be reused from status ${intent.status}`,
        409,
        "CHECKOUT_NOT_REUSABLE",
      );
    }
    if (!user.email) {
      throw new RequestError(
        "An email address is required for checkout",
        409,
        "EMAIL_REQUIRED",
      );
    }

    initializationToken = crypto.randomUUID();
    const { data: claimed, error: claimError } = await admin.rpc(
      "wallet_claim_checkout_initialization",
      {
        p_intent_id: intent.id,
        p_initialization_token: initializationToken,
      },
    );
    if (claimError || !claimed) {
      throw claimError ?? new Error("Could not claim checkout initialization");
    }
    intent = claimed as PaymentIntent;
    if (
      intent.status !== "initializing" ||
      intent.initialization_token !== initializationToken
    ) {
      throw new RequestError(
        "Checkout initialization is already in progress",
        409,
        "CHECKOUT_INITIALIZING",
      );
    }
    currentIntentId = intent.id;

    const siteUrl = requireHttpsUrl(
      Deno.env.get("SITE_URL") ?? "https://feedinn.com",
      "SITE_URL",
    );
    const callbackUrl = new URL(
      `/wallet/${purchaseType === "credits" ? "credits" : "subscription"}`,
      siteUrl,
    ).toString();
    const reference = createPaystackReference(intent.id);
    const persistedPlanCode = optionalString(intent.metadata?.paystack_plan_code);
    const providerMetadata: JsonRecord = {
      user_id: user.id,
      wallet_payment_intent_id: intent.id,
      provider: "paystack",
      type: intent.purchase_type,
      item_id: checkoutItemId(intent),
      amount_minor: String(intent.amount_minor),
      currency: intent.currency,
    };
    if (persistedPlanCode) providerMetadata.plan_code = persistedPlanCode;

    const initializeBody: JsonRecord = {
      email: user.email,
      amount: String(intent.amount_minor),
      currency: intent.currency,
      reference,
      callback_url: callbackUrl,
      metadata: providerMetadata,
    };
    if (persistedPlanCode) initializeBody.plan = persistedPlanCode;

    const { response: initializeResponse, payload: initializePayload } =
      await paystackFetch(
        "/transaction/initialize",
        paystackSecretKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initializeBody),
        },
      );
    const checkout = asRecord(initializePayload.data);
    if (
      !initializeResponse.ok ||
      initializePayload.status !== true ||
      !checkout
    ) {
      throw new RequestError(
        safeProviderMessage(initializePayload.message),
        502,
        "PROVIDER_INITIALIZATION_FAILED",
      );
    }

    const authorizationUrl = requirePaystackCheckoutUrl(
      checkout.authorization_url,
    );
    const providerReference = parseProviderReference(checkout.reference);
    const accessCode = optionalString(checkout.access_code);
    if (providerReference !== reference) {
      throw new RequestError(
        "Payment provider reference mismatch",
        502,
        "PROVIDER_REFERENCE_MISMATCH",
      );
    }

    const { data: initialized, error: initializedError } = await admin.rpc(
      "wallet_mark_checkout_initialized",
      {
        p_intent_id: intent.id,
        p_initialization_token: initializationToken,
        p_provider_reference: providerReference,
        p_provider_checkout_id: accessCode,
        p_checkout_url: authorizationUrl,
        p_expires_at: checkoutExpiry(),
      },
    );
    if (initializedError || !initialized) {
      throw initializedError ?? new Error("Could not save checkout");
    }

    currentIntentId = null;
    initializationToken = null;
    return jsonResponse({
      authorization_url: authorizationUrl,
      access_code: accessCode,
      reference: providerReference,
      payment_intent_id: intent.id,
      idempotency_key: intent.idempotency_key,
      reused: false,
    });
  } catch (error) {
    if (currentIntentId && initializationToken && admin) {
      try {
        await admin.rpc("wallet_mark_checkout_failed", {
          p_intent_id: currentIntentId,
          p_initialization_token: initializationToken,
          p_failure_code: error instanceof RequestError
            ? error.code.toLowerCase()
            : "checkout_error",
          p_failure_message: error instanceof RequestError
            ? error.message
            : "Checkout initialization failed",
        });
      } catch {
        // Preserve the original checkout error.
      }
    }

    const requestError = error instanceof RequestError
      ? error
      : new RequestError(
        "Payment processing failed",
        500,
        "CHECKOUT_ERROR",
      );
    console.error("paystack-checkout", {
      code: requestError.code,
      status: requestError.status,
    });
    return jsonResponse(
      { error: requestError.message, code: requestError.code },
      requestError.status,
    );
  }
});
