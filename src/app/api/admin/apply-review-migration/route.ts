import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY one-shot migration endpoint for the meal-plan-review feature.
// Runs inside the deployment so it can use the (sensitive, un-copyable)
// DATABASE_URL that Vercel injects at runtime. Idempotent (ADD COLUMN IF NOT
// EXISTS). DELETE THIS FILE once the migration has been applied in production.
export const dynamic = "force-dynamic";

const MIGRATION_KEY = "mpp_review_migrate_9d4f1a7c63b84e20a5f9c1e7b2d6308f";

const STATEMENTS = [
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "inclusions" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "exclusions" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "profileNotes" TEXT`,
  `ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "shareToken" TEXT`,
  `ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "clientComment" TEXT`,
  `ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "clientApproved" BOOLEAN`,
  `ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "clientSubmittedAt" TIMESTAMP(3)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_shareToken_key" ON "Proposal"("shareToken")`,
  `ALTER TABLE "ProposalRecipe" ADD COLUMN IF NOT EXISTS "clientRemoved" BOOLEAN NOT NULL DEFAULT false`,
];

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== MIGRATION_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applied: string[] = [];
  try {
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
      applied.push(sql);
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        applied,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Meal-plan review columns applied ✅",
    applied,
  });
}
