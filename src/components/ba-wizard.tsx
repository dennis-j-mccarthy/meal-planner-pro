"use client";

import { useMemo, useState, useTransition } from "react";
import { sendBonAppetitEmail } from "@/app/actions";

interface BaClient {
  id: string;
  name: string;
}

interface BaWizardProps {
  clients: BaClient[];
}

const STEPS = ["Client", "Cook date", "Menu", "Preview"];

export function BaWizard({ clients }: BaWizardProps) {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [menuCardId, setMenuCardId] = useState("");

  const [sending, startSending] = useTransition();
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const selectedClient = clients.find((c) => c.id === clientId);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, query]);

  function goTo(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  async function handleCreate() {
    if (!clientId || !date || !text.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/bon-appetit/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, date, text }),
      });
      const data = await res.json();
      if (!res.ok || !data.bonAppetitId) {
        setCreateError(data.error || "Could not create the Bon Appetit.");
        setCreating(false);
        return;
      }
      setMenuCardId(data.bonAppetitId);
      setCreating(false);
      goTo(3);
    } catch {
      setCreateError("Network error. Please try again.");
      setCreating(false);
    }
  }

  function handleEmail() {
    if (!menuCardId) return;
    setSendError("");
    startSending(async () => {
      try {
        const fd = new FormData();
        fd.set("menuCardId", menuCardId);
        await sendBonAppetitEmail(fd);
        setSent(true);
      } catch {
        setSendError("Could not send the email. Please try again.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Progress dots */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i <= step ? "bg-[var(--accent-strong)]" : "bg-slate-200"
              }`}
            />
          </div>
        ))}
      </div>

      <h1 className="mb-1 text-center text-xl font-bold text-slate-900">
        Quick Bon Appetit
      </h1>
      <p className="mb-5 text-center text-sm text-slate-500">
        Step {step + 1} of {STEPS.length} &middot; {STEPS[step]}
      </p>

      {/* Sliding track */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {/* 1. Choose a client */}
          <section className="w-full shrink-0 px-1">
            <input
              type="text"
              inputMode="search"
              placeholder="Search clients…"
              className="field mb-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pb-1">
              {filteredClients.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  No clients found.
                </p>
              )}
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-base transition-colors ${
                    clientId === c.id
                      ? "border-[var(--accent-strong)] bg-[var(--accent-light)] font-semibold text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 active:bg-slate-50"
                  }`}
                >
                  <span>{c.name}</span>
                  {clientId === c.id && (
                    <svg
                      className="h-5 w-5 text-[var(--accent-strong)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <NavButtons
              onNext={() => goTo(1)}
              nextDisabled={!clientId}
              nextLabel="Next"
            />
          </section>

          {/* 2. Enter cook date */}
          <section className="w-full shrink-0 px-1">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Cook date
            </label>
            <input
              type="date"
              className="field text-base"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="mt-2 text-sm text-slate-500">
              {selectedClient ? `For ${selectedClient.name}` : ""}
            </p>
            <NavButtons
              onBack={() => goTo(0)}
              onNext={() => goTo(2)}
              nextDisabled={!date}
              nextLabel="Next"
            />
          </section>

          {/* 3. Paste BA text */}
          <section className="w-full shrink-0 px-1">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Paste the menu
            </label>
            <textarea
              className="field min-h-[40vh] font-mono text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "Entrees and Sides\nMediterranean Baked Chicken Breasts\nThis vibrant dish features tender chicken…\n\nMorning Nourishment\nGreen Goddess Smoothie Bowl\nA vibrant blend of…"
              }
            />
            {createError && (
              <p className="mt-2 text-sm font-medium text-red-600">{createError}</p>
            )}
            <NavButtons
              onBack={() => goTo(1)}
              onNext={handleCreate}
              nextDisabled={!text.trim() || creating}
              nextLabel={creating ? "Creating…" : "Preview PDF"}
            />
          </section>

          {/* 4. Preview + email */}
          <section className="w-full shrink-0 px-1">
            {menuCardId ? (
              <>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <iframe
                    title="Bon Appetit preview"
                    src={`/api/menu-cards/${menuCardId}/pdf`}
                    className="h-[55vh] w-full"
                  />
                </div>
                <a
                  href={`/api/menu-cards/${menuCardId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-center text-sm font-medium text-[var(--accent-strong)] underline"
                >
                  Open PDF full screen
                </a>

                {sent ? (
                  <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">
                    Sent to Beth ✓
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEmail}
                    disabled={sending}
                    className="button-primary mt-4 w-full justify-center py-3.5 text-base disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Email to me"}
                  </button>
                )}
                {sendError && (
                  <p className="mt-2 text-center text-sm font-medium text-red-600">
                    {sendError}
                  </p>
                )}
              </>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                Finish the previous steps to preview the PDF.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="button-secondary px-5 py-3.5 text-base"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="button-primary flex-1 justify-center py-3.5 text-base disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}
