"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendBonAppetitToClientAction, sendInvoiceToClientAction } from "@/app/actions";
import { sendTasteEmailAction } from "@/app/taste-actions";

interface SendToClientButtonProps {
  /** taste: the "How did it taste?" email; id is the cook date. */
  kind: "invoice" | "menuCard" | "taste";
  id: string;
  clientEmail: string | null;
  /** "secondary" when another button on the page is the main action. */
  variant?: "primary" | "secondary";
  label?: string;
}

type Stage = "idle" | "confirm" | "sending" | "sent" | "error";

// "Send to client" → inline "Send to <email>? [Send] [Cancel]" → "Sending…"
// → "Sent to <email> ✓". Disabled when the client has no email.
export function SendToClientButton({
  kind,
  id,
  clientEmail,
  variant = "primary",
  label = "Send to client",
}: SendToClientButtonProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const email = clientEmail?.trim() || null;
  const buttonClass = variant === "secondary" ? "button-secondary" : "button-primary";

  if (!email) {
    return (
      <button type="button" disabled className={`${buttonClass} text-sm opacity-50 cursor-not-allowed`}>
        Add the client&apos;s email to send
      </button>
    );
  }

  async function handleSend() {
    if (stage === "sending") return;
    setStage("sending");
    setError("");
    const fd = new FormData();
    fd.set(kind === "invoice" ? "invoiceId" : kind === "taste" ? "cookDateId" : "menuCardId", id);
    try {
      const res =
        kind === "invoice"
          ? await sendInvoiceToClientAction(fd)
          : kind === "taste"
            ? await sendTasteEmailAction(fd)
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
          <Send aria-hidden="true" />
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
      <button type="button" onClick={() => setStage("confirm")} className={`${buttonClass} text-sm`}>
        <Send aria-hidden="true" />
        {label}
      </button>
      {stage === "error" && <span className="text-xs text-red-600">Failed — {error}</span>}
    </div>
  );
}
