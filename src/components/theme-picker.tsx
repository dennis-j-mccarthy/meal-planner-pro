"use client";

import { useState, useRef, useEffect } from "react";
import { setTheme } from "@/app/actions";
import { THEMES } from "@/lib/themes";

export function ThemePicker({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
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
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl border shadow-xl z-[100] p-4"
          style={{ background: "var(--panel)", borderColor: "var(--border-soft)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Light themes
          </p>

          <div className="grid grid-cols-5 gap-3 mb-4">
            {THEMES.filter((t) => !t.dark).map((t) => (
              <form
                key={t.id}
                action={setTheme}
                onSubmit={() => setOpen(false)}
              >
                <input type="hidden" name="themeId" value={t.id} />
                <button
                  type="submit"
                  className="group flex flex-col items-center gap-1.5 w-full"
                  title={t.name}
                >
                  <div
                    className={`h-12 w-12 rounded-full ring-offset-2 transition-all ${
                      currentId === t.id
                        ? "ring-2 ring-slate-900 scale-110"
                        : "ring-2 ring-transparent group-hover:ring-slate-300 group-hover:scale-105"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${t.accent} 0%, ${t.accentStrong} 100%)`,
                    }}
                  />
                  <span className="text-[10px] text-slate-600 truncate w-full text-center leading-tight">
                    {t.name}
                  </span>
                </button>
              </form>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Dark themes
          </p>

          <div className="grid grid-cols-4 gap-3">
            {THEMES.filter((t) => t.dark).map((t) => (
              <form
                key={t.id}
                action={setTheme}
                onSubmit={() => setOpen(false)}
              >
                <input type="hidden" name="themeId" value={t.id} />
                <button
                  type="submit"
                  className="group flex flex-col items-center gap-1.5 w-full"
                  title={t.name}
                >
                  <div
                    className={`h-12 w-12 rounded-full ring-offset-2 transition-all relative overflow-hidden ${
                      currentId === t.id
                        ? "ring-2 ring-slate-900 scale-110"
                        : "ring-2 ring-transparent group-hover:ring-slate-300 group-hover:scale-105"
                    }`}
                    style={{ background: t.background }}
                  >
                    <div
                      className="absolute inset-[25%] rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${t.accent} 0%, ${t.accentStrong} 100%)`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-600 truncate w-full text-center leading-tight">
                    {t.name.replace("Dark ", "")}
                  </span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
