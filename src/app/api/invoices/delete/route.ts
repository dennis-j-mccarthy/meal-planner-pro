import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireKitchenApi } from "@/lib/guard";

export async function POST(request: NextRequest) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;

  const { invoiceId } = await request.json();
  if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });

  try {
    const { count } = await prisma.invoice.deleteMany({
      where: { id: invoiceId, kitchenId: kitchen.id },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
