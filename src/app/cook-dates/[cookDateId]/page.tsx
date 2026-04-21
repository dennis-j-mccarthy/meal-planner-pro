import Link from "next/link";
import { notFound } from "next/navigation";
import { quickCreateProposal } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { DeleteCookDateButton } from "@/components/delete-cook-date-button";
import { formatDateLong, formatDateShort, formatEnum, formatMinutes } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function CookDateDetailPage({
  params,
}: {
  params: Promise<{ cookDateId: string }>;
}) {
  const { cookDateId } = await params;
  const kitchen = await getKitchen();

  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    include: {
      client: true,
      finalizedProposal: {
        include: {
          recipes: {
            include: { recipe: true },
            orderBy: { position: "asc" },
          },
        },
      },
      proposals: {
        include: {
          recipes: {
            include: { recipe: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      menuCards: {
        include: {
          recipes: {
            include: { recipe: { select: { title: true } } },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { menuDate: "desc" },
      },
    },
  });

  if (!cookDate) notFound();

  const invoices = await prisma.invoice.findMany({
    where: { kitchenId: kitchen.id, clientId: cookDate.clientId },
    include: { lineItems: { orderBy: { position: "asc" } } },
    orderBy: { invoiceDate: "desc" },
  });

  const approvedMealPlan =
    cookDate.finalizedProposal ??
    cookDate.proposals.find((p) => p.status === "APPROVED") ??
    null;
  const draftMealPlans = cookDate.proposals.filter(
    (p) => p.id !== approvedMealPlan?.id,
  );
  const hasBonAppetit = cookDate.menuCards.length > 0;

  // Determine current step
  const hasMealPlan = cookDate.proposals.length > 0;
  const isApproved = approvedMealPlan !== null;
  const currentStep = hasBonAppetit ? 3 : isApproved ? 3 : hasMealPlan ? 2 : 1;


  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/clients" className="hover:text-slate-900">
          Clients
        </Link>
        <span>/</span>
        <Link
          href={`/clients/${cookDate.client.id}`}
          className="hover:text-slate-900"
        >
          {cookDate.client.firstName} {cookDate.client.lastName}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">
          {formatDateShort(cookDate.scheduledFor)}
        </span>
      </div>

      {/* Header */}
      <div className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {formatDateLong(cookDate.scheduledFor)}
              </h1>
              <StatusBadge label={formatEnum(cookDate.status)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {cookDate.client.firstName} {cookDate.client.lastName}
              {cookDate.startTimeLabel && ` · ${cookDate.startTimeLabel}`}
              {cookDate.guestCount && ` · ${cookDate.guestCount} guests`}
            </p>
            {cookDate.serviceNotes && (
              <p className="mt-2 text-sm text-slate-500">
                {cookDate.serviceNotes}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/invoices?clientId=${cookDate.clientId}`}
              className="button-secondary text-sm"
            >
              + Invoice
            </Link>
            <DeleteCookDateButton cookDateId={cookDate.id} clientId={cookDate.clientId} />
          </div>
        </div>
      </div>


      {/* ===== STEP 1: MEAL PLAN ===== */}
      <div className={`panel p-6 ${currentStep === 1 ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${hasMealPlan ? "bg-green-500 text-white" : "bg-[var(--accent)] text-white"}`}>
              {hasMealPlan ? "✓" : "1"}
            </span>
            <h2 className="text-lg font-bold text-slate-900">Meal Plan</h2>
          </div>
          {!hasMealPlan && (
            <form action={quickCreateProposal}>
              <input type="hidden" name="cookDateId" value={cookDate.id} />
              <button className="button-primary text-sm">
                Create meal plan
              </button>
            </form>
          )}
        </div>

        {approvedMealPlan ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm text-slate-500">{approvedMealPlan.title}</p>
              <StatusBadge label={formatEnum(approvedMealPlan.status)} />
            </div>
            <div className="space-y-2">
              {approvedMealPlan.recipes.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.recipe.title}
                    </p>
                    {item.recipe.description && (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                        {item.recipe.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : draftMealPlans.length > 0 ? (
          <div className="space-y-2">
            {draftMealPlans.map((mp) => (
              <Link
                key={mp.id}
                href={`/proposals/${mp.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{mp.title}</p>
                  <StatusBadge label={formatEnum(mp.status)} />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {mp.recipes.length} recipes
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Start by creating a meal plan — search and drag recipes to build the menu.
          </p>
        )}
      </div>

      {/* ===== STEP 2: CLIENT APPROVAL ===== */}
      <div className={`panel p-6 ${currentStep === 2 ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isApproved ? "bg-green-500 text-white" : hasMealPlan ? "bg-[var(--accent)] text-white" : "bg-slate-200 text-slate-400"}`}>
            {isApproved ? "✓" : "2"}
          </span>
          <h2 className="text-lg font-bold text-slate-900">Client Approval</h2>
        </div>
        {isApproved ? (
          <p className="text-sm text-green-600 font-medium">
            Menu approved — Bon Appetit has been generated.
          </p>
        ) : hasMealPlan ? (
          <p className="text-sm text-slate-500">
            Open the meal plan above, then click &ldquo;Client approved&rdquo; when ready.
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Create a meal plan first, then share it for client approval.
          </p>
        )}
      </div>

      {/* ===== STEP 3: BON APPETIT ===== */}
      <div className={`panel p-6 ${currentStep === 3 && !hasBonAppetit ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${hasBonAppetit ? "bg-green-500 text-white" : isApproved ? "bg-[var(--accent)] text-white" : "bg-slate-200 text-slate-400"}`}>
            {hasBonAppetit ? "✓" : "3"}
          </span>
          <h2 className="text-lg font-bold text-slate-900">Bon Appetit</h2>
        </div>
        {hasBonAppetit ? (
          <div className="space-y-2">
            {cookDate.menuCards.map((mc) => (
              <Link
                key={mc.id}
                href={`/menu-cards/${mc.id}`}
                className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {mc.title}
                  </p>
                  <span className="text-xs text-slate-500">
                    Preview PDF · Send to Beth
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {mc.recipes.map((mr) => (
                    <span
                      key={mr.id}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {mr.recipe.title}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        ) : isApproved ? (
          <p className="text-sm text-slate-500">
            Bon Appetit was auto-generated when the meal plan was approved. Check above.
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            The Bon Appetit is created automatically when the client approves the meal plan.
          </p>
        )}
      </div>

      {/* ===== INVOICES ===== */}
      <div className="panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Invoices</h2>
          <Link
            href={`/invoices?clientId=${cookDate.clientId}`}
            className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            + Create
          </Link>
        </div>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const total = inv.lineItems.reduce(
                (sum, li) => sum + li.amount,
                0,
              );
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      #{inv.invoiceNumber}
                    </p>
                    <StatusBadge label={inv.status} />
                    <p className="text-xs text-slate-500">
                      {formatDateShort(inv.invoiceDate)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    ${total.toFixed(2)}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No invoices for this client yet.
          </p>
        )}
      </div>
    </div>
  );
}
