import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";

export interface ClientRow {
  id: string;
  name: string;
  active: boolean;
  /** Pre-formatted, e.g. "Mon, Nov 30", or null when nothing is scheduled. */
  nextCookDateLabel: string | null;
  notMarkedPaid: number;
}

// Each row is one link to the client's page; everything else happens there.
export function ClientList({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <p className="panel px-5 py-8 text-center text-sm muted">
        No clients yet. Use &ldquo;Add client&rdquo; to add the first household.
      </p>
    );
  }

  return (
    <ul className="panel divide-y divide-[var(--line)]">
      {clients.map((client) => (
        <li key={client.id}>
          <Link
            href={`/clients/${client.id}`}
            className="flex min-h-16 items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--surface-raised)]"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-semibold text-ink">
                <span className="truncate">{client.name}</span>
                {!client.active && <StatusBadge status="INACTIVE" />}
              </p>
              <p className="mt-1 text-sm muted">
                {client.nextCookDateLabel
                  ? `Next cook date ${client.nextCookDateLabel}`
                  : "No upcoming cook date"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {client.notMarkedPaid > 0 && (
                <span className="text-right text-sm">
                  <span className="block font-semibold text-ink">
                    {formatMoney(client.notMarkedPaid)}
                  </span>
                  <span className="block text-xs muted">not marked paid</span>
                </span>
              )}
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-[var(--muted-fg)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
