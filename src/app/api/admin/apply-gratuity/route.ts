import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY one-shot migration endpoint for the Invoice.showGratuity column.
// Idempotent. DELETE THIS FILE once applied in production.
export const dynamic = "force-dynamic";

const MIGRATION_KEY = "mpp_gratuity_migrate_3f9002f65b718a7c7a3bcba4f092e52c";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== MIGRATION_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "showGratuity" BOOLEAN NOT NULL DEFAULT false`,
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "showGratuity column applied" });
}
