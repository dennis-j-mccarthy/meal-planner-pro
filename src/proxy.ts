import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Expose the request path to server components (the root layout reads it to
// render a clean, chrome-free shell for the public /review pages).
export default clerkMiddleware((_auth, req) => {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
