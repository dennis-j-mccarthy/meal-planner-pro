"use client";

export function DeleteCookDateButton({
  cookDateId,
  clientId,
  quiet = false,
}: {
  cookDateId: string;
  clientId: string;
  /** Plain text button for the bottom of a page. */
  quiet?: boolean;
}) {
  async function handleDelete() {
    if (!confirm("Delete this cook date and all its menus and Bon Appetits?")) return;
    const res = await fetch("/api/cook-dates/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookDateId }),
    });
    if (res.ok) {
      window.location.href = `/clients/${clientId}`;
    } else {
      alert("Failed to delete");
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className={
        quiet
          ? "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[var(--muted-fg)] hover:bg-red-50 hover:text-red-700"
          : "button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50"
      }
    >
      Delete cook date
    </button>
  );
}
