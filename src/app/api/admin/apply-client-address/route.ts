import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY one-shot migration for structured client address + secondary email.
// Idempotent. DELETE THIS FILE once applied in production.
export const dynamic = "force-dynamic";

const MIGRATION_KEY = "mpp_clientaddr_migrate_6e2b9f4a1c8d7053e9a4c1b7d3f50286";

const STATEMENTS = [
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "secondaryEmail" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "street" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "city" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "state" TEXT`,
  `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "zip" TEXT`,
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
      { ok: false, applied, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "client address columns applied ✅", applied });
}
