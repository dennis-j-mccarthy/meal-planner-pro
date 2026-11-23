import { NextRequest, NextResponse } from "next/server";
import { requireKitchenApi } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ cookDateId: string; receiptId: string }> };

// One receipt photo, only to the kitchen it belongs to.
export async function GET(_request: NextRequest, { params }: Params) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { cookDateId, receiptId } = await params;

  const receipt = await prisma.groceryReceipt.findFirst({
    where: { id: receiptId, cookDateId, kitchenId: kitchen.id },
    select: { contentType: true, data: true },
  });
  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(receipt.data), {
    headers: {
      "Content-Type": receipt.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { cookDateId, receiptId } = await params;

  await prisma.groceryReceipt.deleteMany({
    where: { id: receiptId, cookDateId, kitchenId: kitchen.id },
  });
  return NextResponse.json({ ok: true });
}
