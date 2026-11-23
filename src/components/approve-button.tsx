"use client";

import { CircleCheck } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ProgressBar } from "@/components/progress-bar";

// "Client approved" inside an approveProposal form. While it runs (approve,
// make the Bon Appetit, open its step) it turns into a progress bar.
export function ApproveButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  if (pending) {
    return (
      <div className="w-64 max-w-full">
        <ProgressBar
          expectedMs={2500}
          label="Making the Bon Appetit"
          stages={["Approving the menu…", "Making the Bon Appetit…", "Opening it…"]}
        />
      </div>
    );
  }
  return (
    <button type="submit" className={className}>
      <CircleCheck aria-hidden="true" />
      Client approved
    </button>
  );
}
