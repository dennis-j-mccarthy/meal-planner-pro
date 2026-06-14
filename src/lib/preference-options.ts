// Shared, filter-ready vocabulary for client food preferences. Stored on
// Client.inclusions / Client.exclusions as comma-separated values so they can
// later drive recipe filtering (match against Recipe.tags / dietaryFlags).
export const PREFERENCE_OPTIONS = [
  "Chicken",
  "Beef",
  "Pork",
  "Fish",
  "Shellfish",
  "Eggs",
  "Tofu",
  "Dairy",
  "Gluten",
  "Nuts",
  "Peanuts",
  "Soy",
  "Sesame",
  "Mushrooms",
  "Onions",
  "Garlic",
  "Tomatoes",
  "Bell peppers",
  "Spicy",
  "Cilantro",
  "Added sugar",
  "Alcohol",
  "Red meat",
  "Pasta",
  "Rice",
  "Bread",
] as const;

/** Split a stored comma-separated preference string into trimmed values. */
export function parsePreferenceList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
