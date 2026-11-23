import { getThemeById } from "@/lib/themes";

// The frame for client-facing pages (menu review, "How did it taste?") and
// the chef's previews of them. The client has no theme cookie: the kitchen's
// own colors are used.
export const CLIENT_DISPLAY_FONT = { fontFamily: "var(--font-display, Georgia, 'Times New Roman', serif)" } as const;

export function ClientPageShell({
  kitchenId,
  preview,
  children,
}: {
  kitchenId: string | null;
  /** Shown above the page when the chef is previewing it. */
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = getThemeById(kitchenId === "kitchen_jwb" ? "jwb" : undefined);
  const style = {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--accent-light": theme.accentLight,
  } as React.CSSProperties;
  return (
    <div style={style} className="min-h-screen bg-[#faf9f7] text-stone-900">
      {preview && (
        <p className="sticky top-0 z-10 bg-stone-900 px-4 py-2 text-center text-xs font-medium text-white">
          {preview}
        </p>
      )}
      <main className="mx-auto max-w-2xl px-4 py-10">{children}</main>
    </div>
  );
}

export function ClientNotice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-[14px] border border-stone-200 bg-white p-6 text-center sm:p-8">
      <h2 className="text-xl text-stone-900" style={CLIENT_DISPLAY_FONT}>
        {title}
      </h2>
      {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
    </div>
  );
}
