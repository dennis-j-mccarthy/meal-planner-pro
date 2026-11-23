// Shared class strings for the planner's calm editorial look.
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

export const DISPLAY_FONT = { fontFamily: "var(--font-display, Georgia, 'Times New Roman', serif)" } as const;

export const CARD = "rounded-[14px] border border-stone-200 bg-white";

/** Quiet secondary button: 44px tall on phones, 36px from sm up. */
export const BTN_QUIET = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 ${FOCUS}`;

export const BTN_PRIMARY = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const ICON_BTN = `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40 sm:h-9 sm:w-9 ${FOCUS}`;
