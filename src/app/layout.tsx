import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { AppNav } from "@/components/app-nav";
import { KitchenSwitcher } from "@/components/kitchen-switcher";
import { ThemePicker } from "@/components/theme-picker";
import { getKitchen, getAllKitchens } from "@/lib/data";
import { isLoggedIn, isDemoMode } from "@/lib/auth";
import { getActiveTheme } from "@/lib/get-theme";
import { exitDemo } from "@/app/actions";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meal Planner Pro",
  description: "Operations software for professional chefs managing clients, proposals, and cook dates.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loggedIn = await isLoggedIn();
  const demoMode = await isDemoMode();
  const kitchen = await getKitchen();
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
      <body className={`${inter.variable} antialiased`}>
        <ClerkProvider>
          <div className="min-h-screen text-slate-900">
            {demoMode && (
              <div className="sticky top-0 z-[60] bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-sm font-semibold">
                <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      Demo
                    </span>
                    <span className="hidden sm:inline">
                      You&apos;re exploring the Meal Planner Pro demo. Anything you change is shared with other demo visitors.
                    </span>
                    <span className="sm:hidden">Demo mode</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SignUpButton mode="modal">
                      <button className="rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold transition-colors">
                        Sign up free
                      </button>
                    </SignUpButton>
                    <form action={exitDemo}>
                      <button
                        type="submit"
                        className="text-xs font-semibold underline hover:no-underline"
                      >
                        Exit demo
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
            <header
              className="sticky top-0 z-50 border-b backdrop-blur-sm"
              style={{ background: "var(--header-bg)", borderColor: "var(--border-soft)" }}
            >
              <div className="mx-auto flex h-48 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-6 shrink-0">
                  <Link href="/" className="block shrink-0">
                    <Image
                      src="/logo-v2.png"
                      alt="Meal Planner Pro"
                      width={800}
                      height={400}
                      className="w-auto object-contain"
                      style={{ height: "12rem" }}
                      priority
                    />
                  </Link>
                  {loggedIn && <AppNav />}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Show when="signed-out">
                    <SignInButton mode="modal">
                      <button className="button-secondary text-sm">Sign in</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="button-primary text-sm">Get started</button>
                    </SignUpButton>
                  </Show>
                  <Show when="signed-in">
                    <ThemePicker currentId={theme.id} />
                    {allKitchens.length > 1 && (
                      <KitchenSwitcher
                        kitchens={allKitchens.map((k) => ({ id: k.id, name: k.name }))}
                        currentId={kitchen.id}
                        userName=""
                      />
                    )}
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: "h-10 w-10 ring-2 ring-slate-200",
                        },
                      }}
                    />
                  </Show>
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
