export interface Theme {
  id: string;
  name: string;
  accent: string;
  accentStrong: string;
  accentLight: string;
  background: string;
}

export const THEMES: Theme[] = [
  {
    id: "warm-orange",
    name: "Warm Orange",
    accent: "#e76f51",
    accentStrong: "#c2563c",
    accentLight: "#fde5dd",
    background: "#fffbf7",
  },
  {
    id: "sage",
    name: "Sage Green",
    accent: "#7a9e7e",
    accentStrong: "#5d7f61",
    accentLight: "#e8efe6",
    background: "#f8faf5",
  },
  {
    id: "rose",
    name: "Dusty Rose",
    accent: "#c47b8e",
    accentStrong: "#9e5f73",
    accentLight: "#f6e2e8",
    background: "#fdf7f9",
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    accent: "#457b9d",
    accentStrong: "#345f7a",
    accentLight: "#dbe7ef",
    background: "#f5f9fc",
  },
  {
    id: "aubergine",
    name: "Aubergine",
    accent: "#7b5e8a",
    accentStrong: "#5e466a",
    accentLight: "#ece4f0",
    background: "#faf7fc",
  },
  {
    id: "marigold",
    name: "Marigold",
    accent: "#d4a574",
    accentStrong: "#a87f4e",
    accentLight: "#f5e9d6",
    background: "#fdfaf4",
  },
  {
    id: "forest",
    name: "Forest",
    accent: "#2a6f55",
    accentStrong: "#1d4e3b",
    accentLight: "#d5e7de",
    background: "#f5f9f6",
  },
  {
    id: "midnight",
    name: "Midnight",
    accent: "#1e3a5f",
    accentStrong: "#122642",
    accentLight: "#d4dde8",
    background: "#f5f7fa",
  },
  {
    id: "berry",
    name: "Berry",
    accent: "#9d2e5e",
    accentStrong: "#7a2348",
    accentLight: "#f4d9e3",
    background: "#fdf5f8",
  },
  {
    id: "jwb",
    name: "Joyful Wellness (Teal)",
    accent: "#009b8d",
    accentStrong: "#00796b",
    accentLight: "#e0f7f3",
    background: "#ffffff",
  },
];

export function getThemeById(id: string | undefined): Theme {
  if (!id) return THEMES[0];
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

// Helper: derive a "light" tint from a hex color
export function lighten(hex: string, pct = 0.85): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * pct);
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

// Helper: derive a "darker" shade
export function darken(hex: string, pct = 0.2): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * (1 - pct));
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
