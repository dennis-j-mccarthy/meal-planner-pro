import { cookies } from "next/headers";

/**
 * Temporary auth stub until Clerk is wired in.
 * A "session" is just a cookie that marks the user as logged in.
 * When Clerk lands, replace these with Clerk's helpers.
 */
export async function isLoggedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("session")?.value === "active";
}
