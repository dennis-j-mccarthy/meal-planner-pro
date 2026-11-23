// How a payment came in. Shared by the invoice "Record payment" form, the
// Money page bulk action, and the server actions that validate them.
export const PAYMENT_METHODS = ["Zelle", "Check", "Cash", "Card", "Other"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(String(value))
    ? (value as PaymentMethod)
    : "Other";
}
