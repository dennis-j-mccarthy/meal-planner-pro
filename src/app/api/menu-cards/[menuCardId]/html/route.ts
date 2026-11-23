import { NextRequest, NextResponse } from "next/server";
import { requireKitchenApi } from "@/lib/guard";
import { loadBonAppetitHtml } from "@/lib/bon-appetit-html";

// The Bon Appetit page as HTML, for the preview inside the cook date steps.
// Same page the PDF is printed from, without the wait for Chromium.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ menuCardId: string }> },
) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { menuCardId } = await params;

  const loaded = await loadBonAppetitHtml(menuCardId, kitchen.id);
  if (!loaded) {
    return NextResponse.json({ error: "Menu card not found" }, { status: 404 });
  }

  return new NextResponse(loaded.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
