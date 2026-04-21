import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export async function isLoggedIn(): Promise<boolean> {
  const { userId } = await auth();
  if (userId) return true;
  const cookieStore = await cookies();
  return cookieStore.get("demo_mode")?.value === "1";
}

export async function isDemoMode(): Promise<boolean> {
  const { userId } = await auth();
  if (userId) return false;
  const cookieStore = await cookies();
  return cookieStore.get("demo_mode")?.value === "1";
}
