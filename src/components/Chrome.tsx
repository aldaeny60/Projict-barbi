"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { PwaSetup } from "./PwaSetup";
import { WhatsAppFloat } from "./WhatsAppFloat";

const BARE_PREFIXES = ["/pos", "/admin"];

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname.startsWith(p));

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
      <WhatsAppFloat />
      <PwaSetup />
    </div>
  );
}
