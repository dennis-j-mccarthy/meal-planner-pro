"use client";

export function DeleteCookDateButton({
  cookDateId,
  clientId,
}: {
  cookDateId: string;
  clientId: string;
}) {
  async function handleDelete() {
    if (!confirm("Delete this cook date and all its proposals and bon appetits?")) return;
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
      className="button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50"
    >
      Delete cook date
    </button>
  );
}
