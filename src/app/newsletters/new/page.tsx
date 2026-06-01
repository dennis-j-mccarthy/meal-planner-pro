import Link from "next/link";
import { NewsletterComposer } from "@/components/newsletter-composer";

export default function NewNewsletterPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/newsletters" className="hover:text-slate-900">
          Newsletters
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">New</span>
      </div>
      <NewsletterComposer />
    </div>
  );
}
