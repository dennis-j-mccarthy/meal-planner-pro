"use client";

import { useEffect, useRef, useState } from "react";

// A letter-size page (816 × 1056 at 96 dpi) shrunk to fit its column. Shows
// the same HTML the PDF is printed from.
const PAGE_W = 816;
const PAGE_H = 1056;

export function BonAppetitPreview({ menuCardId, title }: { menuCardId: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

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
        src={`/api/menu-cards/${menuCardId}/html`}
        title={`Preview of ${title}`}
        loading="lazy"
        className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}
      />
    </div>
  );
}
