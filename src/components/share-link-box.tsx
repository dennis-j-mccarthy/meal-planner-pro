"use client";

import { useEffect, useState } from "react";
import { emailProposalLinkToClient } from "@/app/actions";

export function ShareLinkBox({
  token,
  proposalId,
  clientHasEmail,
}: {
  token: string;
  proposalId: string;
  clientHasEmail: boolean;
}) {
  const [url, setUrl] = useState(`/review/${token}`);
  const [copied, setCopied] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Build an absolute URL on the client so it matches the current deployment.
  useEffect(() => {
    setUrl(`${window.location.origin}/review/${token}`);
  }, [token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select the text manually */
    }
  }

  async function emailClient() {
    setEmailError(null);
    setEmailState("sending");
    try {
      const fd = new FormData();
      fd.set("proposalId", proposalId);
      await emailProposalLinkToClient(fd);
      setEmailState("sent");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Couldn't send the email.");
      setEmailState("idle");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Client review link (no login needed)
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
        />
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="button-secondary text-sm whitespace-nowrap">
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={emailClient}
            disabled={!clientHasEmail || emailState !== "idle"}
            title={clientHasEmail ? "Email this link to the client" : "Client has no email on file"}
            className="button-primary text-sm whitespace-nowrap disabled:opacity-50"
          >
            {emailState === "sending" ? "Sending..." : emailState === "sent" ? "Emailed ✓" : "Email to client"}
          </button>
        </div>
      </div>
      {!clientHasEmail && (
        <p className="mt-2 text-xs text-slate-400">
          Add an email to this client to enable one-click sending.
        </p>
      )}
      {emailError && <p className="mt-2 text-xs text-red-600">{emailError}</p>}
    </div>
  );
}
