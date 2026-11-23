"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="page-title">Something went wrong</h1>
      <p className="mt-3 text-sm muted">
        The page could not be loaded. Try again, and if it keeps happening, go back to Today.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="button-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="button-secondary">
          Go to Today
        </Link>
      </div>
    </div>
  );
}
