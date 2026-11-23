"use client";

import { useEffect, useRef, useState } from "react";

// The client's page, live, in a phone-width frame that grows to the page's
// full height: the menu review or the "How did it taste?" survey. The
// /preview/ pages behind it run the client's buttons without saving or
// sending anything.
export function ClientPagePreview({ src, firstName }: { src: string; firstName: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;

    // Same origin, so the page inside can be measured. Re-measure whenever it
    // changes size (e.g. after the client taps Approve).
    const attach = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const measure = () => setHeight(Math.max(320, doc.body.scrollHeight));
      measure();
      observer?.disconnect();
      observer = new ResizeObserver(measure);
      observer.observe(doc.body);
    };

    frame.addEventListener("load", attach);
    if (frame.contentDocument?.readyState === "complete") attach();
    return () => {
      frame.removeEventListener("load", attach);
      observer?.disconnect();
    };
  }, [src]);

  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <figcaption className="mb-2 text-center text-xs font-semibold uppercase tracking-wide muted">
        What {firstName} sees
      </figcaption>
      <iframe
        ref={frameRef}
        src={src}
        title={`What ${firstName} sees`}
        scrolling="no"
        style={{ height }}
        className="w-full overflow-hidden rounded-[28px] border-[6px] border-slate-800 bg-[#faf9f7] shadow-lg"
      />
    </figure>
  );
}
