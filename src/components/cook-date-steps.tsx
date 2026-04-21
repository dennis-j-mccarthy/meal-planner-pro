import Link from "next/link";

interface CookDateStepsProps {
  cookDateId: string;
  currentStep: 1 | 2 | 3;
  hasMealPlan: boolean;
  isApproved: boolean;
  hasBonAppetit: boolean;
  mealPlanId?: string | null;
  bonAppetitId?: string | null;
}

export function CookDateSteps({
  cookDateId,
  currentStep,
  hasMealPlan,
  isApproved,
  hasBonAppetit,
  mealPlanId,
  bonAppetitId,
}: CookDateStepsProps) {
  const steps = [
    {
      number: 1 as const,
      label: "Meal Plan",
      done: hasMealPlan,
      href: mealPlanId ? `/proposals/${mealPlanId}` : `/cook-dates/${cookDateId}`,
    },
    {
      number: 2 as const,
      label: "Client Approval",
      done: isApproved,
      href: mealPlanId ? `/proposals/${mealPlanId}` : `/cook-dates/${cookDateId}`,
    },
    {
      number: 3 as const,
      label: "Bon Appetit",
      done: hasBonAppetit,
      href: bonAppetitId ? `/menu-cards/${bonAppetitId}` : `/cook-dates/${cookDateId}`,
    },
  ];

  return (
    <div className="panel p-4 sm:p-6 sticky top-32 z-40 bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.number} className="flex items-center flex-1">
            <Link
              href={step.href}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  step.done
                    ? "bg-green-500 text-white group-hover:bg-green-600"
                    : currentStep === step.number
                      ? "bg-[var(--accent)] text-white ring-4 ring-[var(--accent)]/20"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {step.done ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs font-semibold text-center ${
                  step.done
                    ? "text-green-600"
                    : currentStep === step.number
                      ? "text-[var(--accent)]"
                      : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </Link>

            {i < steps.length - 1 && (
              <div className="flex-1 flex items-center justify-center -mt-5">
                <div
                  className={`h-0.5 flex-1 mx-3 ${
                    steps[i + 1].done || currentStep > step.number
                      ? "bg-green-300"
                      : "bg-slate-200"
                  }`}
                />
                <svg
                  className={`h-4 w-4 -ml-2 ${
                    steps[i + 1].done || currentStep > step.number
                      ? "text-green-400"
                      : "text-slate-300"
                  }`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
