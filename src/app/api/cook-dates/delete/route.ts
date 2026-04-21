import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { cookDateId } = await request.json();

  if (!cookDateId) {
    return NextResponse.json({ error: "Missing cookDateId" }, { status: 400 });
  }

  try {
    // Clear finalizedProposalId first to break circular FK
    await prisma.cookDate.update({
      where: { id: cookDateId },
      data: { finalizedProposalId: null },
    });

    await prisma.cookDate.delete({
      where: { id: cookDateId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
