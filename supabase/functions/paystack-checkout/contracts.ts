export type PurchaseType = "credits" | "subscription";
export type BillingInterval = "day" | "week" | "month" | "year";
export type JsonRecord = Record<string, unknown>;

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const providerReferencePattern = /^[A-Za-z0-9._=:-]{1,128}$/;
const maxNativeMinorAmount = 2_147_483_647;

export function parsePurchaseType(value: unknown): PurchaseType {
  if (value === "credits" || value === "subscription") return value;
  throw new RequestError("Invalid payment type");
}

export function parseUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new RequestError(`Invalid ${fieldName}`);
  }
  return value;
}

export function parseProviderReference(value: unknown): string {
  if (typeof value !== "string" || !providerReferencePattern.test(value)) {
    throw new RequestError("Invalid payment reference");
  }
  return value;
}

export function parseBillingInterval(value: unknown): BillingInterval {
  if (
    value === "day" || value === "week" || value === "month" || value === "year"
  ) {
    return value;
  }
  throw new RequestError(
    "Invalid subscription billing interval",
    500,
    "CATALOG_ERROR",
  );
}

export function parseSafeInteger(
  value: unknown,
  fieldName: string,
  options: { allowZero?: boolean; status?: number; code?: string } = {},
): number {
  const numberValue = typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value;
  const minimum = options.allowZero ? 0 : 1;
  if (
    typeof numberValue !== "number" ||
    !Number.isSafeInteger(numberValue) ||
    numberValue < minimum ||
    numberValue > maxNativeMinorAmount
  ) {
    throw new RequestError(
      `Invalid ${fieldName}`,
      options.status ?? 400,
      options.code ?? "INVALID_REQUEST",
    );
  }
  return numberValue;
}

export function parsePaystackMetadata(value: unknown): JsonRecord {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      throw new RequestError(
        "Payment metadata is invalid",
        409,
        "PAYMENT_METADATA_INVALID",
      );
    }
  }
  if (
    candidate == null || typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new RequestError(
      "Payment metadata is invalid",
      409,
      "PAYMENT_METADATA_INVALID",
    );
  }
  return candidate as JsonRecord;
}

export function resolveIdempotencyKey(
  bodyValue: unknown,
  headerValue: string | null,
): string {
  const candidate = typeof bodyValue === "string" && bodyValue.length > 0
    ? bodyValue
    : headerValue;
  if (candidate == null || candidate.length === 0) {
    return crypto.randomUUID();
  }
  if (!idempotencyPattern.test(candidate)) {
    throw new RequestError("Invalid idempotency key");
  }
  return candidate;
}

export function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) {
    throw new RequestError("Invalid catalog currency", 500, "CATALOG_ERROR");
  }
  return value.toUpperCase();
}

export function normalizeCatalogMoney(
  amountMinor: unknown,
  currency: unknown,
): { amountMinor: number; currency: string } {
  return {
    amountMinor: parseSafeInteger(amountMinor, "catalog price", {
      status: 500,
      code: "CATALOG_ERROR",
    }),
    currency: normalizeCurrency(currency),
  };
}

export function parseProviderCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) {
    throw new RequestError(
      "Payment currency metadata is invalid",
      409,
      "PAYMENT_METADATA_INVALID",
    );
  }
  return value.toUpperCase();
}

export function toPaystackPlanInterval(
  interval: BillingInterval,
): "daily" | "weekly" | "monthly" | "annually" {
  switch (interval) {
    case "day":
      return "daily";
    case "week":
      return "weekly";
    case "month":
      return "monthly";
    case "year":
      return "annually";
  }
}

export function createPaystackReference(intentId: string): string {
  return `fi_${parseUuid(intentId, "payment intent ID").replaceAll("-", "")}`;
}

export function checkoutExpiry(from = new Date()): string {
  return new Date(from.getTime() + 30 * 60 * 1000).toISOString();
}

export function requireHttpsUrl(value: string, fieldName: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError(`${fieldName} is not configured`, 500, "CONFIG_ERROR");
  }
  const localHttp = url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localHttp) {
    throw new RequestError(
      `${fieldName} must use HTTPS`,
      500,
      "CONFIG_ERROR",
    );
  }
  return url.toString();
}

export function requirePaystackCheckoutUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new RequestError(
      "Payment provider returned an invalid checkout link",
      502,
      "PROVIDER_RESPONSE_INVALID",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError(
      "Payment provider returned an invalid checkout link",
      502,
      "PROVIDER_RESPONSE_INVALID",
    );
  }

  const hostname = url.hostname.toLowerCase();
  const paystackHost = hostname === "paystack.com" ||
    hostname.endsWith(".paystack.com") ||
    hostname === "paystack.co" ||
    hostname.endsWith(".paystack.co");
  if (url.protocol !== "https:" || !paystackHost) {
    throw new RequestError(
      "Payment provider returned an invalid checkout link",
      502,
      "PROVIDER_RESPONSE_INVALID",
    );
  }
  return url.toString();
}

export function safeProviderMessage(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "Payment provider request failed";
  }
  return value.trim().slice(0, 300);
}
