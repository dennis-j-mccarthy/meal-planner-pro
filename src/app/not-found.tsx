import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="page-title">Page not found</h1>
      <p className="mt-3 text-sm muted">
        This page does not exist, or it was deleted.
      </p>
      <div className="mt-8">
        <Link href="/" className="button-primary">
          Go to Today
        </Link>
      </div>
    </div>
  );
}
