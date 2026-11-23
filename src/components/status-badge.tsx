import { statusBadgeClass, statusLabel } from "@/lib/status";

type StatusBadgeProps = {
  /** Enum value such as "PAID" or "REVISIONS_REQUESTED", or a formatted label. */
  status?: string;
  /** Older call sites pass the label; it is matched exactly, not by substring. */
  label?: string;
  /** Optional text to show instead of the standard label. */
  children?: React.ReactNode;
};

export function StatusBadge({ status, label, children }: StatusBadgeProps) {
  const value = status ?? label ?? "";
  return (
    <span className={statusBadgeClass(value)}>
      {children ?? statusLabel(value)}
    </span>
  );
}
