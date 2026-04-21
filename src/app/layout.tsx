import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import { KitchenSwitcher } from "@/components/kitchen-switcher";
import { logIn, logOut } from "@/app/actions";
import { getKitchen, getAllKitchens } from "@/lib/data";
import { isLoggedIn } from "@/lib/auth";
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

  const isJwb = kitchen.name.includes("Joyful Wellness");
  const displayName = isJwb ? "Chef Beth" : "Demo User";

  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <div className="min-h-screen bg-white text-slate-900">
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="mx-auto grid h-64 max-w-7xl grid-cols-3 items-center px-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                {loggedIn && <AppNav />}
              </div>
              <div className="flex items-center justify-center">
                <Link href="/" className="block">
                  <Image
                    src="/logo-v2.png"
                    alt="Meal Planner Pro"
                    width={900}
                    height={450}
                    className="w-auto object-contain"
                    style={{ height: "15rem" }}
                    priority
                  />
                </Link>
              </div>
              <div className="flex items-center justify-end gap-2">
                {loggedIn ? (
                  <>
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
