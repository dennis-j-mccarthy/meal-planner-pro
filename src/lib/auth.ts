import { auth } from "@clerk/nextjs/server";

export async function isLoggedIn(): Promise<boolean> {
  const { userId } = await auth();
  return !!userId;
}
