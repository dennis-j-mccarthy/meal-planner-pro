import Anthropic from "@anthropic-ai/sdk";
import { buildRecipeFactsPrompt } from "@/lib/gemini";

// Ingredients + per-serving nutrition via Claude (the Gemini account can run
// out of prepaid credits). Returns the parsed JSON object, unvalidated.
export async function generateRecipeFactsClaude(input: {
  title: string;
  description?: string | null;
  ingredientsText?: string | null;
  servings?: number | null;
  timeoutMs?: number;
}): Promise<unknown> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic({ timeout: input.timeoutMs ?? 25_000, maxRetries: 1 });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: buildRecipeFactsPrompt(input) }],
  });
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude returned no JSON");
  return JSON.parse(text.slice(start, end + 1));
}
