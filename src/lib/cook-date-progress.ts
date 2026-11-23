// Where a cook date is in the job: Proposed → Accepted → Bon Appetit →
// Groceries → How did it taste? → Invoice → Paid. Worked out from the data, never stored. Plain module (not
// "use server"): safe to import from server and client components.

export const BILLING_MODES = ["ONE_OFF", "MONTHLY_AHEAD", "MONTHLY_AFTER"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const BILLING_MODE_LABEL: Record<BillingMode, string> = {
  ONE_OFF: "One invoice per cook date",
  MONTHLY_AHEAD: "Monthly, paid ahead",
  MONTHLY_AFTER: "Monthly, paid after",
};

export function normalizeBillingMode(value: unknown): BillingMode {
  return (BILLING_MODES as readonly string[]).includes(String(value))
    ? (value as BillingMode)
    : "ONE_OFF";
}

export function isMonthlyBilling(mode: string | null | undefined) {
  return mode === "MONTHLY_AHEAD" || mode === "MONTHLY_AFTER";
}

export const STEP_KEYS = [
  "proposed",
  "accepted",
  "bonAppetit",
  "groceries",
  "taste",
  "invoice",
  "paid",
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const STEP_LABEL: Record<StepKey, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  bonAppetit: "Bon Appetit",
  groceries: "Groceries",
  taste: "How did it taste?",
  invoice: "Invoice",
  paid: "Paid",
};

type ProposalLike = {
  id: string;
  status: string;
  createdAt: Date;
  recipes: unknown[];
};

type CookDateLike<P extends ProposalLike> = {
  status: string;
  finalizedProposalId: string | null;
  finalizedProposal: P | null;
  proposals: P[];
  menuCards: unknown[];
};

/**
 * "The menu" for a cook date: the approved one when there is one, otherwise
 * the newest proposal that is not archived.
 */
export function activeProposal<P extends ProposalLike>(cd: CookDateLike<P>): P | null {
  if (cd.finalizedProposal) return cd.finalizedProposal;
  const approved = cd.proposals.find((p) => p.status === "APPROVED");
  if (approved) return approved;
  const open = cd.proposals
    .filter((p) => p.status !== "ARCHIVED")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return open[0] ?? null;
}

/** Same rule as Today's "needs a Bon Appetit" check. */
export function isMenuApproved(cd: {
  status: string;
  finalizedProposalId: string | null;
  proposals: { status: string }[];
}) {
  return (
    cd.status === "APPROVED" ||
    cd.finalizedProposalId !== null ||
    cd.proposals.some((p) => p.status === "APPROVED")
  );
}

export type CookDateProgress = {
  done: Record<StepKey, boolean>;
  /** Done without happening (shown as a dash, not a check). */
  skipped: Partial<Record<StepKey, boolean>>;
  /** The step Beth acts on next; null when everything is done or cancelled. */
  current: StepKey | null;
  cancelled: boolean;
};

// Past this, an old cook date no longer asks for "How did it taste?".
const TASTE_WINDOW_DAYS = 14;

/**
 * Three chains: the menu (Proposed → Bon Appetit), the cook (Groceries → How did
 * it taste?) and the money (Invoice → Paid). Later evidence implies the
 * earlier steps of its chain (a Bon Appetit made from an email means the menu
 * was settled; an approval means it was sent). Groceries count as done once
 * the cook date has come. "How did it taste?" waits for the cook date, so
 * before then the current step skips over it.
 */
export function computeProgress(input: {
  cancelled: boolean;
  menuSent: boolean;
  approved: boolean;
  hasBonAppetit: boolean;
  bonAppetitSent: boolean;
  groceriesDone: boolean;
  /** Whole days since the cook date (negative before it, 0 on the day). */
  daysSinceCookDate: number;
  tasteSent: boolean;
  hasInvoice: boolean;
  paid: boolean;
}): CookDateProgress {
  const bonAppetit = input.bonAppetitSent;
  const accepted = bonAppetit || input.hasBonAppetit || input.approved;
  const proposed = accepted || input.menuSent;
  const cooked = input.daysSinceCookDate >= 0;
  const groceries = input.groceriesDone || cooked;
  const tasteTooOld = !input.tasteSent && input.daysSinceCookDate > TASTE_WINDOW_DAYS;
  const taste = input.tasteSent || tasteTooOld;
  const paid = input.paid;
  const invoice = paid || input.hasInvoice;

  const done: Record<StepKey, boolean> = {
    proposed,
    accepted,
    bonAppetit,
    groceries,
    taste,
    invoice,
    paid,
  };

  const open = STEP_KEYS.filter((k) => !done[k]);
  const current = input.cancelled
    ? null
    : (open.find((k) => k !== "taste" || cooked) ?? open[0] ?? null);
  return { done, skipped: { taste: tasteTooOld }, current, cancelled: input.cancelled };
}
