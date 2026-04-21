import { cookies } from "next/headers";
import { getThemeById, lighten, Theme } from "@/lib/themes";

export async function getActiveTheme(): Promise<Theme> {
  const cookieStore = await cookies();
  const themeId = cookieStore.get("theme")?.value;
  const customAccent = cookieStore.get("theme_custom")?.value;

  if (customAccent && /^#[0-9a-fA-F]{6}$/.test(customAccent)) {
    return {
      id: "custom",
      name: "Custom",
      accent: customAccent,
      accentStrong: darkenServer(customAccent, 0.2),
      accentLight: lighten(customAccent, 0.85),
      background: "#ffffff",
    };
  }

  return getThemeById(themeId);
}

function darkenServer(hex: string, pct: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * (1 - pct));
  return `#${[mix(r), mix(g), mix(b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
