import { format } from "date-fns";

export function formatEnum(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDateLong(value: Date) {
  return format(value, "EEEE, MMMM d");
}

export function formatDateShort(value: Date) {
  return format(value, "MMM d, yyyy");
}

export function formatMinutes(prepMinutes?: number | null, cookMinutes?: number | null) {
  const parts = [
    prepMinutes ? `${prepMinutes}m prep` : null,
    cookMinutes ? `${cookMinutes}m cook` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" • ") : "Timing not set";
}
