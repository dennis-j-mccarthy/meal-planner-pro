// "Yes, Chef!" wordmark: "Yes" in a green script, ", Chef!" in the serif.
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span
      role="img"
      aria-label="Yes, Chef!"
      className={`inline-flex items-baseline whitespace-nowrap leading-none ${big ? "text-5xl sm:text-6xl" : "text-xl"}`}
    >
      <span aria-hidden className="font-script" style={{ color: "#2f7d4f", fontSize: "1.45em", marginRight: "0.03em" }}>
        Yes
      </span>
      <span aria-hidden className="font-display font-semibold tracking-tight text-ink">
        , Chef!
      </span>
    </span>
  );
}
