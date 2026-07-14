import {
  createPaystackReference,
  parsePaystackMetadata,
  parseProviderCurrency,
  parsePurchaseType,
  requirePaystackCheckoutUrl,
  resolveIdempotencyKey,
  toPaystackPlanInterval,
  toPaystackAmountMinor,
} from "./contracts.ts";

Deno.test("uses native minor-unit prices for NGN", () => {
  const amount = toPaystackAmountMinor(250000, "NGN", null);
  if (amount !== 250000) throw new Error(`Unexpected amount: ${amount}`);
});

Deno.test("converts native USD cents to NGN kobo", () => {
  const amount = toPaystackAmountMinor(499, "USD", 1600);
  if (amount !== 798400) throw new Error(`Unexpected amount: ${amount}`);
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
