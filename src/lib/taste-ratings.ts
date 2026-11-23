// "How did it taste?" answers for one dish. Plain module: safe to import from
// client components.
export const TASTE_RATINGS = ["loved", "liked", "not"] as const;
export type TasteRating = (typeof TASTE_RATINGS)[number];

export const TASTE_RATING_LABEL: Record<TasteRating, string> = {
  loved: "Loved it",
  liked: "It was good",
  not: "Not for me",
};
