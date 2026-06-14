import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY one-shot migration endpoint for the recipe nutrition column.
// Idempotent. DELETE THIS FILE once applied in production.
export const dynamic = "force-dynamic";

const MIGRATION_KEY = "mpp_nutrition_migrate_3c7f2a9e15b84d06e8a1c4b7d2f60593";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== MIGRATION_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "nutrition" TEXT`,
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "nutrition column applied ✅" });
}
