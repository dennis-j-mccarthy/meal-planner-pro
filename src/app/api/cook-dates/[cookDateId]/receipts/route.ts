import { NextRequest, NextResponse } from "next/server";
import { requireKitchenApi } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

// Receipt photos for a cook date's groceries. The browser shrinks each photo
// before upload, so a few hundred KB is normal; anything over the cap is
// refused rather than stored.
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PER_COOK_DATE = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ cookDateId: string }> }) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { cookDateId } = await params;

  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    select: { id: true, _count: { select: { groceryReceipts: true } } },
  });
  if (!cookDate) return NextResponse.json({ error: "Cook date not found" }, { status: 404 });
  if (cookDate._count.groceryReceipts >= MAX_PER_COOK_DATE) {
    return NextResponse.json({ error: `Up to ${MAX_PER_COOK_DATE} receipts per cook date` }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("receipt");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No photo" }, { status: 400 });
  if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Not a photo" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large" }, { status: 400 });

  const receipt = await prisma.groceryReceipt.create({
    data: {
      kitchenId: kitchen.id,
      cookDateId: cookDate.id,
      contentType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
    },
    select: { id: true },
  });
  return NextResponse.json({ id: receipt.id });
}
