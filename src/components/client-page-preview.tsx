// The client's page, live, in a phone-sized frame: the menu review or the
// "How did it taste?" survey. The /preview/ pages behind it run the client's
// buttons without saving or sending anything.
export function ClientPagePreview({ src, firstName }: { src: string; firstName: string }) {
  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <figcaption className="mb-2 text-center text-xs font-semibold uppercase tracking-wide muted">
        What {firstName} sees
      </figcaption>
      <iframe
        src={src}
        title={`What ${firstName} sees`}
        loading="lazy"
        className="h-[640px] w-full rounded-[28px] border-[6px] border-slate-800 bg-[#faf9f7] shadow-lg"
      />
    </figure>
  );
}
