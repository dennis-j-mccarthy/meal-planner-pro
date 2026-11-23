import { BILLING_MODES, BILLING_MODE_LABEL, normalizeBillingMode } from "@/lib/cook-date-progress";

// "Billing" block for the add / edit client forms: how the client is
// invoiced, the rate per cook date and an optional travel fee.
export function ClientBillingFields({
  billingMode,
  defaultRate,
  travelFee,
  idPrefix,
}: {
  billingMode?: string | null;
  defaultRate?: number | null;
  travelFee?: number | null;
  idPrefix: string;
}) {
  return (
    <fieldset className="md:col-span-2 grid gap-3 rounded-xl border border-[var(--line)] p-4 md:grid-cols-2">
      <legend className="px-1 text-xs font-semibold text-slate-500">Billing</legend>
      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-billingMode`} className="mb-1 block text-sm font-medium text-slate-700">
          How they are invoiced
        </label>
        <select
          id={`${idPrefix}-billingMode`}
          name="billingMode"
          className="field"
          defaultValue={normalizeBillingMode(billingMode)}
        >
          {BILLING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {BILLING_MODE_LABEL[mode]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-defaultRate`} className="mb-1 block text-sm font-medium text-slate-700">
          Rate per cook date
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            id={`${idPrefix}-defaultRate`}
            name="defaultRate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="field pl-7!"
            defaultValue={defaultRate ?? ""}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-travelFee`} className="mb-1 block text-sm font-medium text-slate-700">
          Travel fee <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            id={`${idPrefix}-travelFee`}
            name="travelFee"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="field pl-7!"
            defaultValue={travelFee ?? ""}
          />
        </div>
      </div>
    </fieldset>
  );
}
