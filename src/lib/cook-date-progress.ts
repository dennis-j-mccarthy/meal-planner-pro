// Where a cook date is in the job: Plan → Proposed → Accepted → Bon Appetit →
// Invoice → Paid. Worked out from the data, never stored. Plain module (not
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

export const STEP_KEYS = ["plan", "proposed", "accepted", "bonAppetit", "invoice", "paid"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const STEP_LABEL: Record<StepKey, string> = {
  plan: "Plan",
  proposed: "Proposed",
  accepted: "Accepted",
  bonAppetit: "Bon Appetit",
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
  /** The step Beth acts on next; null when everything is done or cancelled. */
  current: StepKey | null;
  cancelled: boolean;
};

/**
 * Two chains: the menu (Plan → Bon Appetit) and the money (Invoice → Paid).
 * Later evidence implies the earlier steps of its chain (a Bon Appetit made
 * from an email means the menu was settled; an approval means it was sent).
 * A monthly-ahead invoice can exist before the menu, so the money chain does
 * not mark menu steps done. The current step is the first open menu step,
 * then the first open money step.
 */
export function computeProgress(input: {
  cancelled: boolean;
  menuHasDishes: boolean;
  menuSent: boolean;
  approved: boolean;
  hasBonAppetit: boolean;
  hasInvoice: boolean;
  paid: boolean;
}): CookDateProgress {
  const bonAppetit = input.hasBonAppetit;
  const accepted = bonAppetit || input.approved;
  const proposed = accepted || input.menuSent;
  const plan = proposed || input.menuHasDishes;
  const paid = input.paid;
  const invoice = paid || input.hasInvoice;

  const done: Record<StepKey, boolean> = {
    plan,
    proposed,
    accepted,
    bonAppetit,
    invoice,
    paid,
  };

  const current = input.cancelled ? null : (STEP_KEYS.find((k) => !done[k]) ?? null);
  return { done, current, cancelled: input.cancelled };
}
