"use client";

import { useState } from "react";
import { CookDateCalendar } from "@/components/cook-date-calendar";
import { createCookDate } from "@/app/actions";

type CalendarCookDate = {
  id: string;
  scheduledFor: string;
  startTimeLabel: string | null;
  guestCount: number | null;
  status: string;
  serviceNotes: string | null;
  clientName: string;
  proposalTitle: string | null;
};

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

export function CookDatesView({
  cookDates,
  clients,
  preselectedClientId = "",
}: {
  cookDates: CalendarCookDate[];
  clients: Client[];
  preselectedClientId?: string;
}) {
  const [date, setDate] = useState("");
  const [clientId, setClientId] = useState(preselectedClientId);

  return (
    <>
      {/* Calendar */}
      <section className="panel p-6">
        <CookDateCalendar
          cookDates={cookDates}
          initialMonth={new Date().getMonth()}
          initialYear={new Date().getFullYear()}
          clients={clients}
          onDateSelect={(d) => setDate(d)}
        />
      </section>

      {/* Create form */}
      <form action={createCookDate} className="panel p-6">
        <h2 className="text-lg font-bold text-slate-900">
          Create a cook date
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Click a day on the calendar to pre-fill the date.
        </p>
        <div className="mt-5 grid gap-3">
          <select className="field" name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option disabled value="">
              Select a client
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName} {client.lastName}
              </option>
            ))}
          </select>
          <input
            className="field"
            name="scheduledFor"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            className="field"
            name="guestCount"
            type="number"
            min="1"
            placeholder="Guest count"
          />
          <textarea
            className="field min-h-24"
            name="serviceNotes"
            placeholder="Service notes, kitchen access, prep constraints"
          />
        </div>
        <button className="button-primary mt-5" type="submit">
          Save cook date
        </button>
      </form>
    </>
  );
}
