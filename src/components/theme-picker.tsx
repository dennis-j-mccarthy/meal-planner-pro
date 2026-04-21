"use client";

import { useState, useRef, useEffect } from "react";
import { setTheme, setCustomTheme } from "@/app/actions";
import { THEMES } from "@/lib/themes";

export function ThemePicker({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState("#e76f51");
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 hover:border-slate-300 transition-colors"
        title="Change theme"
      >
        <div className="h-4 w-4 rounded-full bg-[var(--accent)]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-xl z-[100] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Color theme
          </p>

          <div className="grid grid-cols-5 gap-2 mb-3">
            {THEMES.map((t) => (
              <form key={t.id} action={setTheme}>
                <input type="hidden" name="themeId" value={t.id} />
                <button
                  type="submit"
                  className={`group flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-slate-50 transition-colors ${
                    currentId === t.id ? "bg-slate-100" : ""
                  }`}
                  title={t.name}
                >
                  <div
                    className={`h-8 w-8 rounded-full ring-2 transition-all ${
                      currentId === t.id
                        ? "ring-slate-900 ring-offset-2"
                        : "ring-transparent group-hover:ring-slate-300"
                    }`}
                    style={{ backgroundColor: t.accent }}
                  />
                  <span className="text-[9px] text-slate-500 truncate w-full text-center">
                    {t.name.split(" ")[0]}
                  </span>
                </button>
              </form>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Custom color
            </p>
            <form
              action={setCustomTheme}
              className="flex items-center gap-2"
            >
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                className="h-9 w-12 rounded cursor-pointer border border-slate-200"
              />
              <input
                type="text"
                name="hex"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm font-mono"
              />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Apply
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
