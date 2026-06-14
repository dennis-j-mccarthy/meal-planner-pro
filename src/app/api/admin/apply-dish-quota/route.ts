import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY one-shot migration endpoint for the client dish-quota column.
// Idempotent. DELETE THIS FILE once applied in production.
export const dynamic = "force-dynamic";

const MIGRATION_KEY = "mpp_dishquota_migrate_4b8e1f6a2c9d70e3f5a8c1b6d4e92708";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== MIGRATION_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "dishQuota" TEXT`,
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "dishQuota column applied ✅" });
}
