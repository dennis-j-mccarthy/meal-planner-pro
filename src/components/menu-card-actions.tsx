"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMenuCard, sendBonAppetitEmail, acceptMenuCard } from "@/app/actions";

interface MenuCardActionsProps {
  menuCardId: string;
  accepted: boolean;
}

type SendStatus = "idle" | "sending" | "sent" | "error";

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-60";

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

  const sendTitle =
    sendStatus === "sending"
      ? "Sending…"
      : sendStatus === "sent"
        ? "Sent to Beth ✓"
        : sendStatus === "error"
          ? "Send failed — retry"
          : "Send to Beth";

  const sendColor =
    sendStatus === "sent"
      ? "border-green-200 bg-green-50 text-green-600"
      : sendStatus === "error"
        ? "border-red-200 text-red-600 hover:bg-red-50"
        : "border-blue-200 text-blue-600 hover:bg-blue-50";

  return (
    <div className="flex items-center gap-1">
      {/* Preview PDF */}
      <a
        href={`/api/menu-cards/${menuCardId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        title="Preview PDF"
        aria-label="Preview PDF"
        className={`${iconBtn} border-slate-200 text-slate-600 hover:bg-slate-50`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </a>

      {/* Send to Beth (Resend) */}
      <button
        onClick={handleSend}
        disabled={sendStatus === "sending"}
        title={sendTitle}
        aria-label={sendTitle}
        className={`${iconBtn} ${sendColor}`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
      </button>

      {/* Mark proposal accepted */}
      {!accepted ? (
        <form action={acceptMenuCard}>
          <input type="hidden" name="menuCardId" value={menuCardId} />
          <button
            title="Mark proposal accepted"
            aria-label="Mark proposal accepted"
            className={`${iconBtn} border-green-200 text-green-600 hover:bg-green-50`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        </form>
      ) : (
        <span
          title="Accepted"
          aria-label="Accepted"
          className={`${iconBtn} border-green-200 bg-green-50 text-green-600`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </span>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        title="Delete"
        aria-label="Delete"
        className={`${iconBtn} border-red-200 text-red-600 hover:bg-red-50`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  );
}
