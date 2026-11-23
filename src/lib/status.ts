// One status vocabulary for invoices, cook dates and menus (proposals).
// Shared by the StatusBadge and the calendar dots. Plain module: safe to
// import from server and client components.

export type StatusTone =
  | "neutral"
  | "accent"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "muted";

const TONE: Record<string, StatusTone> = {
  // Invoice
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  VOID: "muted",
  // Cook date
  PROPOSED: "warning",
  APPROVED: "success",
  SCHEDULED: "accent",
  COMPLETED: "success",
  CANCELLED: "muted",
  // Menu (proposal)
  REVISIONS_REQUESTED: "warning",
  ARCHIVED: "neutral",
  // Client
  ACTIVE: "success",
  INACTIVE: "neutral",
  // Recipe details / intake
  READY: "success",
  QUEUED: "warning",
  PROCESSING: "info",
  STARTER: "warning",
  FAILED: "danger",
};

// Labels that read better than the raw enum.
const LABEL: Record<string, string> = {
  REVISIONS_REQUESTED: "Changes requested",
};

/** "Revisions Requested" / "revisions_requested" / "PAID" -> "REVISIONS_REQUESTED" / "PAID". */
export function statusKey(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function statusTone(value: string): StatusTone {
  return TONE[statusKey(value)] ?? "neutral";
}

export function statusLabel(value: string) {
  const key = statusKey(value);
  if (LABEL[key]) return LABEL[key];
  return key
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** CSS class for a small coloured dot (calendar). */
export function statusDotClass(value: string) {
  return `dot dot-${statusTone(value)}`;
}

/** CSS classes for a status pill. */
export function statusBadgeClass(value: string) {
  return `badge badge-${statusTone(value)}`;
}

/** Cook-date statuses in the order the calendar legend lists them. */
export const COOK_DATE_LEGEND = [
  "DRAFT",
  "PROPOSED",
  "APPROVED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;
