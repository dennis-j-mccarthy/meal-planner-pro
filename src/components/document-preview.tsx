"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/progress-bar";

// A letter-size page (816 × 1056 at 96 dpi) shrunk to fit its column: the
// Bon Appetit or the invoice, from the same HTML the PDF is printed from.
// While the page is being built, a progress bar sits over the blank page.
const PAGE_W = 816;
const PAGE_H = 1056;

export function DocumentPreview({
  src,
  title,
  progress,
}: {
  src: string;
  /** Accessible name of the frame, e.g. "Preview of Bon Appetit, Arwen!". */
  title: string;
  /** Shown until the page has loaded. */
  progress?: { expectedMs: number; stages: string[]; label: string };
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.6);
  const [loaded, setLoaded] = useState(false);

  // The page may finish loading before React attaches onLoad: check once,
  // on the next frame.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const doc = frameRef.current?.contentDocument;
      if (doc && doc.readyState === "complete" && doc.URL !== "about:blank") setLoaded(true);
    });
    return () => cancelAnimationFrame(id);
  }, [src]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setScale(box.clientWidth / PAGE_W);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm"
      style={{ height: PAGE_H * scale }}
    >
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        onLoad={() => setLoaded(true)}
        className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
      />
      {progress && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white px-8">
          <div className="w-full max-w-xs">
            <ProgressBar expectedMs={progress.expectedMs} stages={progress.stages} label={progress.label} />
          </div>
        </div>
      )}
    </div>
  );
}
