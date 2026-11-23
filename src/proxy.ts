import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// The only routes reachable without signing in. Everything else is protected:
// pages redirect to sign-in, API requests get Clerk's default 404.
const isPublicRoute = createRouteMatcher([
  "/",
  "/review/(.*)",
  "/api/inbound/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

// Expose the request path to server components (the root layout reads it to
// render a clean, chrome-free shell for the public /review pages).
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

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
