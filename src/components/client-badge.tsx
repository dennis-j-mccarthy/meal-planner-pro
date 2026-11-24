// A client's round badge: their photo when one was added, otherwise the
// first letter of the first name and of the last name ("Kristen & Chris" +
// "Dries" → "KD"). No hooks, so it works in server and client components.

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
} as const;

export function clientInitials(firstName: string, lastName: string) {
  const letter = (s: string) => s.trim().match(/\p{L}/u)?.[0]?.toUpperCase() ?? "";
  return letter(firstName) + letter(lastName) || "?";
}

export function clientAvatarSrc(clientId: string, avatarUpdatedAt: Date | number | null | undefined) {
  if (!avatarUpdatedAt) return null;
  const v = typeof avatarUpdatedAt === "number" ? avatarUpdatedAt : avatarUpdatedAt.getTime();
  return `/api/clients/${clientId}/avatar?v=${v}`;
}

export function ClientBadge({
  clientId,
  firstName,
  lastName,
  avatarUpdatedAt,
  size = "md",
  muted = false,
}: {
  clientId: string;
  firstName: string;
  lastName: string;
  avatarUpdatedAt?: Date | number | null;
  size?: keyof typeof SIZES;
  /** Inactive client: grey instead of the accent colour. */
  muted?: boolean;
}) {
  const src = clientAvatarSrc(clientId, avatarUpdatedAt);
  const box = `${SIZES[size]} shrink-0 rounded-full`;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, kitchen-only image route
      <img src={src} alt="" aria-hidden="true" className={`${box} border border-[var(--line)] object-cover ${muted ? "grayscale" : ""}`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex items-center justify-center font-bold tracking-wide text-white ${
        muted ? "bg-slate-400" : "bg-[var(--accent)]"
      }`}
    >
      {clientInitials(firstName, lastName)}
    </span>
  );
}
