// Shared class strings for the planner, in the app's panel/button language.
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

/** Headings: bold sans, tight tracking (matches .page-title). */
export const DISPLAY_FONT = { fontWeight: 700, letterSpacing: "-0.025em" } as const;

export const CARD = "panel";

/** Quiet secondary button: 44px tall on phones, 36px from sm up. */
export const BTN_QUIET = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border-soft)] bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 ${FOCUS}`;

export const BTN_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_color-mix(in_srgb,var(--accent)_35%,transparent)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const ICON_BTN = `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 sm:h-9 sm:w-9 ${FOCUS}`;
