import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireKitchenApi } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

// A client's badge photo, only to the kitchen the client belongs to. The
// browser crops and shrinks it to a small square before upload.
const MAX_BYTES = 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Params = { params: Promise<{ clientId: string }> };

async function ownClient(kitchenId: string, clientId: string) {
  return prisma.client.findFirst({ where: { id: clientId, kitchenId }, select: { id: true } });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { clientId } = await params;

  const avatar = await prisma.clientAvatar.findFirst({
    where: { clientId, kitchenId: kitchen.id },
    select: { contentType: true, data: true },
  });
  if (!avatar) return NextResponse.json({ error: "No photo" }, { status: 404 });

  // The URL carries ?v=<updated time>, so a new photo is a new URL.
  return new NextResponse(new Uint8Array(avatar.data), {
    headers: { "Content-Type": avatar.contentType, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { clientId } = await params;
  if (!(await ownClient(kitchen.id, clientId))) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No photo" }, { status: 400 });
  if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Not a photo" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large" }, { status: 400 });

  const data = new Uint8Array(await file.arrayBuffer());
  const now = new Date();
  await prisma.$transaction([
    prisma.clientAvatar.upsert({
      where: { clientId },
      create: { clientId, kitchenId: kitchen.id, contentType: file.type, data },
      update: { contentType: file.type, data },
    }),
    prisma.client.update({ where: { id: clientId }, data: { avatarUpdatedAt: now } }),
  ]);
  revalidatePath("/", "layout");
  return NextResponse.json({ version: now.getTime() });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { clientId } = await params;
  if (!(await ownClient(kitchen.id, clientId))) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.clientAvatar.deleteMany({ where: { clientId, kitchenId: kitchen.id } }),
    prisma.client.update({ where: { id: clientId }, data: { avatarUpdatedAt: null } }),
  ]);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
