import { NextRequest, NextResponse } from "next/server";
import { searchEdamamRecipes } from "@/lib/edamam";

export async function GET(request: NextRequest) {
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
