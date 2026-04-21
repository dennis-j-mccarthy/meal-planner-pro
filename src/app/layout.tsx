import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import { KitchenSwitcher } from "@/components/kitchen-switcher";
import { ThemePicker } from "@/components/theme-picker";
import { logIn } from "@/app/actions";
import { getKitchen, getAllKitchens } from "@/lib/data";
import { isLoggedIn } from "@/lib/auth";
import { getActiveTheme } from "@/lib/get-theme";
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
  const kitchen = await getKitchen();
  const allKitchens = await getAllKitchens();
  const theme = await getActiveTheme();

  const themeStyle = {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--accent-light": theme.accentLight,
  } as React.CSSProperties;

  const isJwb = kitchen.name.includes("Joyful Wellness");
  const displayName = isJwb ? "Chef Beth" : "Demo User";

  return (
    <html lang="en" style={themeStyle}>
      <body className={`${inter.variable} antialiased`}>
        <div className="min-h-screen bg-white text-slate-900">
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="mx-auto flex h-32 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-6 shrink-0">
                <Link href="/" className="block shrink-0">
                  <Image
                    src="/logo-v2.png"
                    alt="Meal Planner Pro"
                    width={600}
                    height={300}
                    className="w-auto object-contain"
                    style={{ height: "6rem" }}
                    priority
                  />
                </Link>
                {loggedIn && <AppNav />}
              </div>
              <div className="flex items-center justify-end gap-2">
                {loggedIn ? (
                  <>
                    <ThemePicker currentId={theme.id} />
                    {isJwb ? (
                      <Image
                        src="/beth-avatar.png"
                        alt="Chef Beth"
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full ring-2 ring-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 ring-2 ring-slate-200 text-sm font-semibold text-slate-600">
                        D
                      </div>
                    )}
                    {allKitchens.length > 1 ? (
                      <KitchenSwitcher
                        kitchens={allKitchens.map((k) => ({ id: k.id, name: k.name }))}
                        currentId={kitchen.id}
                        userName={displayName}
                      />
                    ) : (
                      <div className="hidden sm:block text-right">
                        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="text-xs text-slate-500">{kitchen.name}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <form action={logIn}>
                    <button className="button-primary text-sm">Sign in</button>
                  </form>
                )}
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
