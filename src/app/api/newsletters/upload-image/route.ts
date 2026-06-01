import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getKitchen } from "@/lib/data";

// Vercel serverless functions cap body size at ~4.5MB. The client already
// resizes images down to ~150-300KB before upload, so this is plenty of
// headroom for a single image.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Kitchen-scoped: only authenticated users (or demo mode) can upload.
  const kitchen = await getKitchen();
  if (!kitchen) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // Path: newsletters/<kitchenId>/<random>-<originalName>
  const originalName =
    file instanceof File && file.name ? file.name : "image.jpg";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `newsletters/${kitchen.id}/${Date.now()}-${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    contentType: file.type || "image/jpeg",
    addRandomSuffix: true,
  });

  return NextResponse.json({ url: blob.url });
}
