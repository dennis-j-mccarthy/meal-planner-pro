import { NextRequest, NextResponse } from "next/server";
import { searchEdamamRecipes } from "@/lib/edamam";
import { requireKitchenApi } from "@/lib/guard";

export async function GET(request: NextRequest) {
  // Signed-in only: each search spends the Edamam quota.
  const { error } = await requireKitchenApi();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const health = searchParams.getAll("health").filter(Boolean);
  const diet = searchParams.getAll("diet").filter(Boolean);

  if (!query) {
    return NextResponse.json({ recipes: [], count: 0 });
  }

  try {
    const result = await searchEdamamRecipes({ query, health, diet });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Edamam search error:", error);
    return NextResponse.json(
      { error: "Recipe search failed" },
      { status: 500 },
    );
  }
}
