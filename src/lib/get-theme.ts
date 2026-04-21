import { cookies } from "next/headers";
import { getThemeById, Theme } from "@/lib/themes";

export async function getActiveTheme(): Promise<Theme> {
  const cookieStore = await cookies();
  const themeId = cookieStore.get("theme")?.value;
  return getThemeById(themeId);
}
