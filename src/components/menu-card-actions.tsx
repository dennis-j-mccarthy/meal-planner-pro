"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMenuCard, sendBonAppetitEmail, acceptMenuCard } from "@/app/actions";

interface MenuCardActionsProps {
  menuCardId: string;
  accepted: boolean;
}

type SendStatus = "idle" | "sending" | "sent" | "error";

export function MenuCardActions({ menuCardId, accepted }: MenuCardActionsProps) {
  const router = useRouter();
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");

  async function handleSend() {
    if (sendStatus === "sending") return;
    setSendStatus("sending");
    try {
      const fd = new FormData();
      fd.set("menuCardId", menuCardId);
      await sendBonAppetitEmail(fd);
      setSendStatus("sent");
    } catch {
      setSendStatus("error");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this Bon Appetit? This cannot be undone.")) return;
    const fd = new FormData();
    fd.set("menuCardId", menuCardId);
    await deleteMenuCard(fd);
    router.push("/menu-cards");
  }

  const sendLabel =
    sendStatus === "sending"
      ? "Sending…"
      : sendStatus === "sent"
        ? "Sent to Beth ✓"
        : sendStatus === "error"
          ? "Failed — retry"
          : "Send to Beth";

  const sendClass =
    sendStatus === "sent"
      ? "button-secondary text-sm border-green-200 text-green-700 bg-green-50"
      : sendStatus === "error"
        ? "button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50"
        : "button-secondary text-sm border-blue-200 text-blue-700 hover:bg-blue-50";

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/menu-cards/${menuCardId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="button-primary text-sm"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Preview PDF
      </a>
      <button onClick={handleSend} disabled={sendStatus === "sending"} className={`${sendClass} disabled:opacity-60`}>
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
        {sendLabel}
      </button>
      {!accepted ? (
        <form action={acceptMenuCard}>
          <input type="hidden" name="menuCardId" value={menuCardId} />
          <button className="button-secondary text-sm border-green-200 text-green-700 hover:bg-green-50">
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Proposal Accepted
          </button>
        </form>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Accepted
        </span>
      )}
      <button
        onClick={handleDelete}
        className="button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50 ml-auto"
      >
        Delete
      </button>
    </div>
  );
}
