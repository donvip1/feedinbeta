import {
  createPaystackReference,
  normalizeCatalogMoney,
  parsePaystackMetadata,
  parseProviderCurrency,
  parsePurchaseType,
  requirePaystackCheckoutUrl,
  resolveIdempotencyKey,
  toPaystackPlanInterval,
} from "./contracts.ts";

Deno.test("keeps catalog amounts in their configured currency", () => {
  const usd = normalizeCatalogMoney(499, "usd");
  const ngn = normalizeCatalogMoney(250000, "NGN");
  if (usd.amountMinor !== 499 || usd.currency !== "USD") {
    throw new Error(`Unexpected USD catalog money: ${JSON.stringify(usd)}`);
  }
  if (ngn.amountMinor !== 250000 || ngn.currency !== "NGN") {
    throw new Error(`Unexpected NGN catalog money: ${JSON.stringify(ngn)}`);
  }
});

Deno.test("keeps legacy purchase type values", () => {
  if (parsePurchaseType("credits") !== "credits") {
    throw new Error("Credits purchase type was not accepted");
  }
  if (parsePurchaseType("subscription") !== "subscription") {
    throw new Error("Subscription purchase type was not accepted");
  }
});

Deno.test("validates explicit idempotency keys", () => {
  const key = resolveIdempotencyKey("checkout:retry-123", null);
  if (key !== "checkout:retry-123") throw new Error("Key was changed");
});

Deno.test("parses object and string Paystack metadata", () => {
  const objectMetadata = parsePaystackMetadata({ provider: "paystack" });
  const stringMetadata = parsePaystackMetadata('{"provider":"paystack"}');
  if (
    objectMetadata.provider !== "paystack" ||
    stringMetadata.provider !== "paystack"
  ) {
    throw new Error("Metadata was not parsed");
  }
});

Deno.test("rejects malformed provider currency as payment metadata", () => {
  let rejected = false;
  try {
    parseProviderCurrency("NGN!");
  } catch (error) {
    rejected = error instanceof Error &&
      error.message === "Payment currency metadata is invalid";
  }
  if (!rejected) throw new Error("Malformed provider currency was accepted");
});

Deno.test("maps native billing intervals to Paystack intervals", () => {
  if (toPaystackPlanInterval("month") !== "monthly") {
    throw new Error("Monthly interval was not mapped");
  }
  if (toPaystackPlanInterval("year") !== "annually") {
    throw new Error("Annual interval was not mapped");
  }
});

Deno.test("accepts only secure Paystack checkout URLs", () => {
  const url = requirePaystackCheckoutUrl(
    "https://checkout.paystack.com/example",
  );
  if (url !== "https://checkout.paystack.com/example") {
    throw new Error(`Unexpected URL: ${url}`);
  }

  let rejected = false;
  try {
    requirePaystackCheckoutUrl("https://example.com/checkout");
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Non-Paystack URL was accepted");
});

Deno.test("creates deterministic Paystack references from intent IDs", () => {
  const reference = createPaystackReference(
    "123e4567-e89b-42d3-a456-426614174000",
  );
  if (reference !== "fi_123e4567e89b42d3a456426614174000") {
    throw new Error(`Unexpected reference: ${reference}`);
  }
});
