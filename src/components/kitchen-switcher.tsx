"use client";

import { useState, useRef, useEffect } from "react";
import { switchKitchen, logOut } from "@/app/actions";

interface Kitchen {
  id: string;
  name: string;
}

export function KitchenSwitcher({
  kitchens,
  currentId,
  userName,
}: {
  kitchens: Kitchen[];
  currentId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = kitchens.find((k) => k.id === currentId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-900">{userName}</p>
          <p className="text-xs text-slate-500">{current?.name}</p>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Switch kitchen
            </p>
          </div>
          {kitchens.map((k) => (
            <form key={k.id} action={switchKitchen}>
              <input type="hidden" name="kitchenId" value={k.id} />
              <button
                type="submit"
                onClick={() => setOpen(false)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                  k.id === currentId
                    ? "font-semibold text-slate-900"
                    : "text-slate-600"
                }`}
              >
                {k.id === currentId && (
                  <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                {k.id !== currentId && <span className="w-4" />}
                {k.name}
              </button>
            </form>
          ))}

          <div className="border-t border-slate-100">
            <form action={logOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
