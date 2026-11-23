"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendBonAppetitToClientAction, sendInvoiceToClientAction } from "@/app/actions";

interface SendToClientButtonProps {
  kind: "invoice" | "menuCard";
  id: string;
  clientEmail: string | null;
}

type Stage = "idle" | "confirm" | "sending" | "sent" | "error";

// "Send to client" → inline "Send to <email>? [Send] [Cancel]" → "Sending…"
// → "Sent to <email> ✓". Disabled when the client has no email.
export function SendToClientButton({ kind, id, clientEmail }: SendToClientButtonProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const email = clientEmail?.trim() || null;

  if (!email) {
    return (
      <button type="button" disabled className="button-primary text-sm opacity-50 cursor-not-allowed">
        Add the client&apos;s email to send
      </button>
    );
  }

  async function handleSend() {
    if (stage === "sending") return;
    setStage("sending");
    setError("");
    const fd = new FormData();
    fd.set(kind === "invoice" ? "invoiceId" : "menuCardId", id);
    try {
      const res =
        kind === "invoice"
          ? await sendInvoiceToClientAction(fd)
          : await sendBonAppetitToClientAction(fd);
      if (res.ok) {
        setSentTo(res.to);
        setStage("sent");
        router.refresh();
      } else {
        setError(res.error);
        setStage("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setStage("error");
    }
  }

  if (stage === "confirm" || stage === "sending") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-700">Send to {email}?</span>
        <button
          type="button"
          onClick={handleSend}
          disabled={stage === "sending"}
          className="button-primary text-sm disabled:opacity-60"
        >
          {stage === "sending" ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setStage("idle")}
          disabled={stage === "sending"}
          className="button-secondary text-sm disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (stage === "sent") {
    return <span className="inline-flex items-center text-sm font-medium text-green-600">Sent to {sentTo} ✓</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setStage("confirm")} className="button-primary text-sm">
        Send to client
      </button>
      {stage === "error" && <span className="text-xs text-red-600">Failed — {error}</span>}
    </div>
  );
}
