import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Fraunces, Great_Vibes, Inter } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { AppNav, MobileTabBar } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { KitchenSwitcher } from "@/components/kitchen-switcher";
import { ThemePicker } from "@/components/theme-picker";
import { getKitchen, getAllKitchens } from "@/lib/data";
import { getActiveTheme } from "@/lib/get-theme";
import "./globals.css";

// Script face for the "Yes" in the Yes, Chef! logo.
const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Variable font (covers the 500/600 weights used for headings). Listing
// static weights makes Google serve a "kit" URL that Turbopack cannot load.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yes, Chef!",
  description: "Operations software for professional chefs managing clients, menus, and cook dates.",
};

// viewport-fit=cover so env(safe-area-inset-bottom) works for the phone tab bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Public client-facing review pages render chrome-free (no app nav, no auth).
  const pathname = (await headers()).get("x-pathname") || "";
  if (pathname.startsWith("/review")) {
    return (
      <html lang="en">
        <body className={`${inter.variable} antialiased`}>{children}</body>
      </html>
    );
  }

  // null for signed-out visitors (marketing page only).
  const kitchen = await getKitchen();
  const loggedIn = kitchen !== null;
  const allKitchens = await getAllKitchens();
  const theme = await getActiveTheme();

  const themeStyle = {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--accent-light": theme.accentLight,
    "--border-soft": theme.accentLight,
    "--theme-bg": theme.background,
  } as React.CSSProperties;

  return (
    <html lang="en" style={themeStyle} className={theme.dark ? "dark" : ""}>
      <body className={`${inter.variable} ${fraunces.variable} ${greatVibes.variable} antialiased`}>
        <ClerkProvider>
          <div className="min-h-screen text-slate-900">
            <header
              className="sticky top-0 z-50 border-b backdrop-blur-sm"
              style={{ background: "var(--header-bg)", borderColor: "var(--line)" }}
            >
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-8">
                  <Link
                    href="/"
                    className="shrink-0"
                    title={kitchen?.name}
                  >
                    <Logo />
                  </Link>
                  {loggedIn && <AppNav />}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-3">
                  <Show when="signed-out">
                    <SignInButton mode="modal">
                      <button className="button-secondary">Sign in</button>
                    </SignInButton>
                  </Show>
                  <Show when="signed-in">
                    <ThemePicker currentId={theme.id} />
                    {kitchen && allKitchens.length > 1 && (
                      <KitchenSwitcher
                        kitchens={allKitchens.map((k) => ({ id: k.id, name: k.name }))}
                        currentId={kitchen.id}
                        userName=""
                      />
                    )}
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: "h-9 w-9",
                        },
                      }}
                    />
                  </Show>
                </div>
              </div>
            </header>
            <main
              className={`mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8 ${
                loggedIn ? "page-bottom-pad" : "pb-12"
              }`}
            >
              {children}
            </main>
            {loggedIn && <MobileTabBar />}
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
