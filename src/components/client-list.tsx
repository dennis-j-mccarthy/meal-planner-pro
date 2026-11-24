import Link from "next/link";
import { ClientBadge } from "@/components/client-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";

export interface ClientRow {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUpdatedAt: number | null;
  active: boolean;
  /** Pre-formatted, e.g. "Mon, Nov 30", or null when nothing is scheduled. */
  nextCookDateLabel: string | null;
  notMarkedPaid: number;
}

// Each row is one link to the client's page; everything else happens there.
export function ClientList({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        No clients yet. Use &ldquo;Add client&rdquo; to add the first household.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {clients.map((client) => (
        <li key={client.id}>
          <Link
            href={`/clients/${client.id}`}
            className={`group flex min-h-16 items-center gap-4 rounded-xl border bg-white px-5 py-4 transition-all hover:border-[var(--accent)] hover:shadow-md ${
              client.active ? "border-slate-200" : "border-slate-200 opacity-70"
            }`}
          >
            <ClientBadge
              clientId={client.id}
              firstName={client.firstName}
              lastName={client.lastName}
              avatarUpdatedAt={client.avatarUpdatedAt}
              muted={!client.active}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <span className="truncate">{client.name}</span>
                {!client.active && <StatusBadge status="INACTIVE" />}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {client.nextCookDateLabel ? (
                  <>
                    Next cook date <span className="font-medium text-slate-700">{client.nextCookDateLabel}</span>
                  </>
                ) : (
                  "No upcoming cook date"
                )}
              </p>
            </div>
            {client.notMarkedPaid > 0 && (
              <span className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-right">
                <span className="block text-sm font-bold text-amber-700">{formatMoney(client.notMarkedPaid)}</span>
                <span className="block text-xs text-amber-700/80">not marked paid</span>
              </span>
            )}
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
